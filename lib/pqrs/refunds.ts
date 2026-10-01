import type { SupabaseClient } from '@supabase/supabase-js';
import { computeRefund, type OrderMoney, type RefundBreakdown, type RefundLine, type RefundScope } from './refund-amount';
import { PqrsInputError } from './errors';
import type { PqrsRefund, PqrsViewer } from './types';

/**
 * Devoluciones: crearlas, leerlas y lo que el administrador puede hacer con una
 * ya creada. La plata se mueve en la base (`create_order_refund` y compañía),
 * en una sola transacción; acá se prepara lo que esas funciones reciben y se
 * traduce lo que responden.
 */

export type RefundLiable = 'store' | 'logistics' | 'platform';

/** Lo que las funciones de la base responden cuando no procede, dicho para una persona. */
const MENSAJES: Record<string, string> = {
  PEDIDO_NO_EXISTE: 'El pedido de este caso ya no existe.',
  PEDIDO_SIN_PAGO: 'Este pedido no tiene un pago aprobado: no hay nada que devolver.',
  DEVOLUCION_EXCEDE_PEDIDO: 'Con esta devolución se devolvería más de lo que se pagó por el pedido. Revisa las devoluciones anteriores.',
  CANTIDAD_EXCEDE_PEDIDO: 'Uno de los productos ya se devolvió en otro caso: no se puede devolver más de lo que se pidió.',
  PRODUCTO_NO_ES_DEL_PEDIDO: 'Uno de los productos no es de este pedido.',
  SALDO_INSUFICIENTE: 'El comprador ya usó parte de ese saldo, así que no se puede cambiar por dinero.',
  DEVOLUCION_YA_EN_DINERO: 'Esta devolución ya se había pasado a dinero.',
  DEVOLUCION_NO_EXISTE: 'Este caso no tiene una devolución.',
  SIN_DESCUENTO_VIGENTE: 'Esta devolución no tiene un descuento vigente a la tienda.',
  DESCUENTO_YA_LIQUIDADO: 'El descuento ya entró a una liquidación. Si es un borrador, cancélalo primero.',
};

function traducir(error: { message?: string } | null, respaldo: string): Error {
  const clave = Object.keys(MENSAJES).find((k) => error?.message?.includes(k));
  return clave ? new PqrsInputError(MENSAJES[clave], 409) : new Error(`${respaldo}: ${error?.message ?? ''}`);
}

interface OrderForRefund {
  money: OrderMoney;
  paid: boolean;
  buyerId: string | null;
  lines: (RefundLine & { name: string })[];
}

async function loadOrderForRefund(service: SupabaseClient<any>, orderId: string): Promise<OrderForRefund | null> {
  const { data: order } = await service
    .from('orders')
    .select(
      `buyer_id, payment_status, subtotal, total, delivery_fee,
       service_commission_amount, messages_amount, platform_commission_amount,
       order_items ( id, catalog_name, quantity, unit_price )`
    )
    .eq('id', orderId)
    .maybeSingle();

  if (!order) return null;

  return {
    paid: order.payment_status === 'approved',
    buyerId: order.buyer_id,
    money: {
      subtotal: Number(order.subtotal ?? 0),
      serviceCommission: Number(order.service_commission_amount ?? 0),
      messagesAmount: Number(order.messages_amount ?? 0),
      platformCommission: Number(order.platform_commission_amount ?? 0),
      deliveryFee: Number(order.delivery_fee ?? 0),
      total: Number(order.total ?? 0),
    },
    lines: ((order as any).order_items ?? []).map((i: any) => ({
      orderItemId: i.id,
      name: i.catalog_name,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unit_price),
    })),
  };
}

interface PqrsForRefund {
  id: string;
  order_id: string | null;
  store_order_id: string | null;
  store_id: string | null;
  buyer_id: string | null;
}

/**
 * La cuenta de la devolución de un caso, sin guardar nada.
 *
 * `quantities` permite al administrador devolver menos de lo reclamado (medio
 * kilo de los dos que el comprador marcó); sin él se usa lo reclamado.
 */
export async function quoteRefund(
  service: SupabaseClient<any>,
  pqrs: PqrsForRefund,
  scope: RefundScope,
  quantities?: Record<string, number>
): Promise<RefundBreakdown | null> {
  if (!pqrs.order_id) return null;

  const order = await loadOrderForRefund(service, pqrs.order_id);
  if (!order || !order.paid) return null;

  if (scope === 'order') return computeRefund(order.money, order.lines, 'order');

  const { data: reclamados } = await service
    .from('pqrs_items')
    .select('order_item_id, quantity')
    .eq('pqrs_id', pqrs.id);

  const lines: RefundLine[] = [];
  for (const reclamado of reclamados ?? []) {
    const linea = order.lines.find((l) => l.orderItemId === reclamado.order_item_id);
    if (!linea) continue;

    const pedida = quantities?.[reclamado.order_item_id];
    const quantity = pedida === undefined ? Number(reclamado.quantity) : Number(pedida);

    if (!(quantity > 0) || quantity > linea.quantity) {
      throw new PqrsInputError(`La cantidad a devolver de «${linea.name}» debe estar entre 0 y ${linea.quantity}.`);
    }
    lines.push({ orderItemId: linea.orderItemId, quantity, unitPrice: linea.unitPrice });
  }

  if (lines.length === 0) return null;
  return computeRefund(order.money, lines, 'items');
}

/**
 * Crea la devolución de un caso aprobado: acredita el saldo y, si la asume la
 * tienda, anota el descuento. Es idempotente por caso: reintentar la misma
 * aprobación no acredita dos veces.
 */
export async function createRefundForPqrs(
  service: SupabaseClient<any>,
  params: {
    pqrs: PqrsForRefund;
    scope: RefundScope;
    liable: RefundLiable;
    quantities?: Record<string, number>;
    actorId: string;
  }
): Promise<void> {
  const { pqrs } = params;

  if (!pqrs.order_id || !pqrs.store_id || !pqrs.buyer_id) {
    throw new PqrsInputError('Este caso no tiene pedido, tienda o comprador: no se puede devolver nada.');
  }

  const cuenta = await quoteRefund(service, pqrs, params.scope, params.quantities);
  if (!cuenta || cuenta.total <= 0) {
    throw new PqrsInputError(
      'No hay nada que devolver: el pedido no tiene un pago aprobado o el caso no tiene productos marcados.'
    );
  }

  const { error } = await service.rpc('create_order_refund', {
    p: {
      pqrs_id: pqrs.id,
      order_id: pqrs.order_id,
      store_order_id: pqrs.store_order_id ?? '',
      store_id: pqrs.store_id,
      buyer_id: pqrs.buyer_id,
      scope: cuenta.scope,
      products_amount: cuenta.products,
      service_commission_amount: cuenta.serviceCommission,
      platform_commission_amount: cuenta.platformCommission,
      messages_amount: cuenta.messages,
      delivery_amount: cuenta.delivery,
      total_amount: cuenta.total,
      liable: params.liable,
      created_by: params.actorId,
      items: cuenta.items.map((i) => ({ order_item_id: i.orderItemId, quantity: i.quantity, amount: i.amount })),
    },
  });

  if (error) throw traducir(error, 'No se pudo registrar la devolución');
}

/**
 * La devolución de un caso, recortada según quién mira:
 *
 * - el comprador ve cuánto recibió y cómo;
 * - la tienda ve solo lo que se le descuenta a ella;
 * - el admin ve el desglose completo.
 */
export async function getRefundOfPqrs(
  service: SupabaseClient<any>,
  pqrsId: string,
  viewer: PqrsViewer
): Promise<PqrsRefund | null> {
  const { data: r } = await service
    .from('order_refunds')
    .select(
      `id, scope, products_amount, service_commission_amount, platform_commission_amount,
       messages_amount, delivery_amount, total_amount, liable, method, status,
       money_reference, money_paid_at, created_at,
       store_charges ( id, amount, voided_at, payout_items ( id ) )`
    )
    .eq('pqrs_id', pqrsId)
    .maybeSingle();

  if (!r) return null;

  // `refund_id` es único en `store_charges`, así que llega uno o ninguno.
  const cargo = Array.isArray(r.store_charges) ? r.store_charges[0] : r.store_charges;
  const cargoVigente = cargo && !cargo.voided_at ? Number(cargo.amount) : 0;
  const cargoLiquidado = Boolean(cargo && (cargo.payout_items ?? []).length > 0);

  const esAdmin = viewer === 'admin';
  const esTienda = viewer === 'seller';

  return {
    createdAt: r.created_at,
    // Al comprador le importa el total; a la tienda, su parte.
    total: esTienda ? null : Number(r.total_amount),
    method: esTienda ? null : r.method,
    status: esTienda ? null : r.status,
    moneyPaidAt: esTienda ? null : r.money_paid_at,
    storeCharge: viewer === 'buyer' ? null : cargoVigente,
    breakdown: esAdmin
      ? {
          scope: r.scope,
          products: Number(r.products_amount),
          serviceCommission: Number(r.service_commission_amount),
          platformCommission: Number(r.platform_commission_amount),
          messages: Number(r.messages_amount),
          delivery: Number(r.delivery_amount),
          liable: r.liable,
          moneyReference: r.money_reference,
        }
      : null,
    can: {
      toMoney: esAdmin && r.method === 'credit' && r.status === 'credited',
      markPaid: esAdmin && r.status === 'money_pending',
      voidStoreCharge: esAdmin && cargoVigente > 0 && !cargoLiquidado,
    },
  };
}

async function refundIdOf(service: SupabaseClient<any>, pqrsId: string): Promise<string> {
  const { data } = await service.from('order_refunds').select('id').eq('pqrs_id', pqrsId).maybeSingle();
  if (!data) throw new PqrsInputError(MENSAJES.DEVOLUCION_NO_EXISTE, 404);
  return data.id;
}

/** El comprador exigió su dinero: se le quita el saldo y queda un reembolso por pagar. */
export async function convertRefundToMoney(service: SupabaseClient<any>, pqrsId: string, actorId: string): Promise<void> {
  const refundId = await refundIdOf(service, pqrsId);
  const { error } = await service.rpc('refund_to_money', { p_refund: refundId, p_by: actorId });
  if (error) throw traducir(error, 'No se pudo pasar la devolución a dinero');
}

/** El reembolso en dinero ya se hizo por fuera; queda la constancia. */
export async function markRefundPaid(
  service: SupabaseClient<any>,
  pqrsId: string,
  actorId: string,
  reference: string
): Promise<void> {
  const refundId = await refundIdOf(service, pqrsId);

  const { data, error } = await service
    .from('order_refunds')
    .update({
      status: 'money_paid',
      money_reference: reference,
      money_paid_at: new Date().toISOString(),
      money_paid_by: actorId,
    })
    .eq('id', refundId)
    .eq('status', 'money_pending')
    .select('id');

  if (error) throw new Error(`No se pudo registrar el pago: ${error.message}`);
  if (!data?.length) throw new PqrsInputError('Esta devolución no tiene un reembolso en dinero pendiente.', 409);
}

/** La tienda no debía asumirlo: el descuento se anula y lo asume MercaMesa. */
export async function voidStoreCharge(
  service: SupabaseClient<any>,
  pqrsId: string,
  actorId: string,
  notes: string
): Promise<void> {
  const refundId = await refundIdOf(service, pqrsId);
  const { error } = await service.rpc('void_store_charge', { p_refund: refundId, p_by: actorId, p_notes: notes });
  if (error) throw traducir(error, 'No se pudo quitar el descuento');
}

export interface BuyerCredit {
  balance: number;
  movements: { id: string; amount: number; kind: string; notes: string | null; createdAt: string; orderCode: string | null }[];
}

/** El saldo a favor de un comprador y sus últimos movimientos. */
export async function loadBuyerCredit(service: SupabaseClient<any>, buyerId: string): Promise<BuyerCredit> {
  const [{ data: saldo, error }, { data: movimientos }] = await Promise.all([
    service.rpc('buyer_credit_balance', { p_buyer: buyerId }),
    service
      .from('buyer_credit_movements')
      .select('id, amount, kind, notes, created_at, orders ( code )')
      .eq('buyer_id', buyerId)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  if (error) throw new Error(`No se pudo leer el saldo: ${error.message}`);

  return {
    balance: Number(saldo ?? 0),
    movements: (movimientos ?? []).map((m: any) => ({
      id: m.id,
      amount: Number(m.amount),
      kind: m.kind,
      notes: m.notes,
      createdAt: m.created_at,
      orderCode: m.orders?.code ?? null,
    })),
  };
}
