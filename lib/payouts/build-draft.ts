import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { loadPayoutSettings, type PayoutSettings } from './settings';

/**
 * Qué pedidos se le pueden pagar a las tiendas, y cuáles no y por qué.
 *
 * Es la ÚNICA fuente de elegibilidad: la usan el botón de la pantalla y el
 * trabajo de los martes y jueves. Si cada uno tuviera su propia consulta, un día
 * el borrador automático y el manual tomarían pedidos distintos.
 *
 * Devuelve también los descartados con su razón. Un pedido que no aparece por
 * ningún lado parece un error del sistema; uno que aparece diciendo "la tienda
 * no tiene cuenta verificada" es una tarea para alguien.
 */

/** Un pedido listo para pagar. */
export interface PedidoElegible {
  storeOrderId: string;
  storeOrderCode: string | null;
  storeId: string;
  storeName: string;
  amount: number;
  deliveredAt: string | null;
  bankAccountId: string;
}

export type RazonDescarte =
  | 'sin_cuenta_verificada'
  | 'en_espera'
  | 'sin_factura'
  | 'sin_monto';

export const EXPLICACION_DESCARTE: Record<RazonDescarte, string> = {
  sin_cuenta_verificada: 'La tienda no tiene una cuenta bancaria verificada',
  en_espera: 'Entregado hace muy poco; sigue en el periodo de espera',
  sin_factura: 'La factura electrónica todavía no se ha emitido',
  sin_monto: 'El pedido no tiene valor que pagar',
};

export interface PedidoDescartado {
  storeOrderId: string;
  storeOrderCode: string | null;
  storeName: string;
  amount: number;
  reason: RazonDescarte;
}

export interface Elegibilidad {
  settings: PayoutSettings;
  elegibles: PedidoElegible[];
  descartados: PedidoDescartado[];
  total: number;
}

/**
 * Reúne lo dispersable a día de hoy.
 *
 * Las cinco condiciones, y por qué cada una:
 *
 *   1. El pedido está `delivered`. Es el único estado terminal con éxito; no
 *      existe "finalizado" en el sistema.
 *   2. El comprador pagó (`payment_status = 'approved'`). Pagarle a la tienda
 *      por algo que nadie pagó sería sacar plata de la plataforma.
 *   3. No es venta de mostrador (`client_id` nulo): ahí el tendero ya recibió el
 *      dinero en su local.
 *   4. Pasó el periodo de espera desde la entrega. Es el único colchón contra
 *      una devolución, porque el sistema no tiene flujo de devoluciones y un
 *      pedido entregado sí se puede pasar a `returned` a mano.
 *   5. La factura electrónica ya salió, y la tienda tiene cuenta verificada.
 *
 * El "no está ya en otra liquidación" no se comprueba acá por gusto sino porque
 * es barato: la garantía de verdad es el índice único sobre
 * `payout_items.store_order_id`, que aguanta incluso dos procesos a la vez.
 */
export async function calcularElegibilidad(
  service: SupabaseClient<any>
): Promise<Elegibilidad> {
  const settings = await loadPayoutSettings(service);

  // Los pedidos entregados de compras pagadas que no son de mostrador. El
  // `!inner` es lo que convierte el filtro sobre `orders` en un join de verdad.
  const entregados = await fetchAllRows<any>((from, to) =>
    service
      .from('store_orders')
      .select(
        `id, code, store_id, subtotal, order_id,
         stores!inner ( id, name ),
         orders!inner ( id, payment_status, client_id )`
      )
      .eq('status', 'delivered')
      .eq('orders.payment_status', 'approved')
      .is('orders.client_id', null)
      .range(from, to)
  );

  if (entregados.length === 0) {
    return { settings, elegibles: [], descartados: [], total: 0 };
  }

  const storeOrderIds = entregados.map((so) => so.id);
  const orderIds = Array.from(new Set(entregados.map((so) => so.order_id)));
  const storeIds = Array.from(new Set(entregados.map((so) => so.store_id)));

  // Lo que ya se pagó (o está en un borrador vivo). Los ítems de una liquidación
  // cancelada se borran, así que esos pedidos vuelven a estar disponibles.
  const yaLiquidados = new Set(
    (
      await fetchAllRows<any>((from, to) =>
        service.from('payout_items').select('store_order_id').in('store_order_id', storeOrderIds).range(from, to)
      )
    ).map((i) => i.store_order_id)
  );

  // Cuándo se entregó de verdad. `store_orders.updated_at` se mueve por
  // cualquier cambio, así que el periodo de espera se cuenta desde el registro
  // del cambio de estado, que es la fecha real.
  const historial = await fetchAllRows<any>((from, to) =>
    service
      .from('store_order_status_history')
      .select('store_order_id, created_at')
      .eq('status', 'delivered')
      .in('store_order_id', storeOrderIds)
      .order('created_at', { ascending: false })
      .range(from, to)
  );

  const entregadoEn = new Map<string, string>();
  for (const h of historial) {
    if (!entregadoEn.has(h.store_order_id)) entregadoEn.set(h.store_order_id, h.created_at);
  }

  const facturadas = new Set(
    (
      await fetchAllRows<any>((from, to) =>
        service.from('siigo_invoices').select('order_id').eq('status', 'sent').in('order_id', orderIds).range(from, to)
      )
    ).map((f) => f.order_id)
  );

  const cuentas = await fetchAllRows<any>((from, to) =>
    service
      .from('store_bank_accounts')
      .select('id, store_id')
      .eq('status', 'verified')
      .eq('is_current', true)
      .in('store_id', storeIds)
      .range(from, to)
  );
  const cuentaDe = new Map<string, string>(cuentas.map((c) => [c.store_id, c.id]));

  const limite = Date.now() - settings.holdDays * 24 * 60 * 60 * 1000;

  const elegibles: PedidoElegible[] = [];
  const descartados: PedidoDescartado[] = [];

  for (const so of entregados) {
    if (yaLiquidados.has(so.id)) continue; // Ya pagado: ni elegible ni descartado.

    const storeName = so.stores?.name ?? 'Tienda';
    const amount = Number(so.subtotal ?? 0);
    const base = { storeOrderId: so.id, storeOrderCode: so.code, storeName, amount };

    if (amount <= 0) {
      descartados.push({ ...base, reason: 'sin_monto' });
      continue;
    }

    // El orden importa: se reporta el primer motivo, y conviene que sea el que
    // alguien puede resolver. Esperar se resuelve solo; verificar una cuenta y
    // emitir una factura, no.
    if (!cuentaDe.has(so.store_id)) {
      descartados.push({ ...base, reason: 'sin_cuenta_verificada' });
      continue;
    }

    if (!facturadas.has(so.order_id)) {
      descartados.push({ ...base, reason: 'sin_factura' });
      continue;
    }

    const deliveredAt = entregadoEn.get(so.id) ?? null;
    // Sin registro del cambio de estado no se puede saber cuándo se entregó, y
    // adivinar acortaría el colchón. Se deja esperando.
    if (!deliveredAt || new Date(deliveredAt).getTime() > limite) {
      descartados.push({ ...base, reason: 'en_espera' });
      continue;
    }

    elegibles.push({
      ...base,
      storeId: so.store_id,
      deliveredAt,
      bankAccountId: cuentaDe.get(so.store_id)!,
    });
  }

  return {
    settings,
    elegibles,
    descartados,
    total: elegibles.reduce((suma, e) => suma + e.amount, 0),
  };
}

export class SinPedidosError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SinPedidosError';
  }
}

export interface BorradorCreado {
  payoutId: string;
  itemsCount: number;
  storesCount: number;
  totalAmount: number;
  descartados: PedidoDescartado[];
}

/**
 * Crea el borrador. No genera el archivo: eso pasa al aprobarlo.
 *
 * `scheduledFor` es la fecha en que el banco procesará el archivo, y por defecto
 * es hoy porque el archivo se sube el mismo día que se genera.
 */
export async function construirBorrador(
  service: SupabaseClient<any>,
  opciones: { scheduledFor?: string; generatedBy?: string | null } = {}
): Promise<BorradorCreado> {
  const { settings, elegibles, descartados, total } = await calcularElegibilidad(service);

  if (elegibles.length === 0) {
    throw new SinPedidosError(
      'No hay pedidos por dispersar en este momento.'
    );
  }

  const { data: payout, error: payoutError } = await service
    .from('payouts')
    .insert({
      status: 'draft',
      scheduled_for: opciones.scheduledFor ?? new Date().toISOString().slice(0, 10),
      settings_id: settings.id,
      total_amount: total,
      items_count: elegibles.length,
      generated_by: opciones.generatedBy ?? null,
      generated_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (payoutError || !payout) {
    throw new Error(`No se pudo crear la liquidación: ${payoutError?.message}`);
  }

  const { error: itemsError } = await service.from('payout_items').insert(
    elegibles.map((e) => ({
      payout_id: payout.id,
      store_order_id: e.storeOrderId,
      store_id: e.storeId,
      bank_account_id: e.bankAccountId,
      amount: e.amount,
    }))
  );

  // Si los ítems fallan —típicamente porque otro proceso tomó los mismos
  // pedidos y el índice único lo frenó— la liquidación se borra entera. Una
  // liquidación vacía o a medias es peor que ninguna: aparece en la lista como
  // si algo se hubiera pagado.
  if (itemsError) {
    await service.from('payouts').delete().eq('id', payout.id);
    throw new Error(
      itemsError.message.includes('payout_items_store_order_unico')
        ? 'Otra liquidación tomó estos pedidos mientras se armaba esta. Vuelve a intentarlo.'
        : `No se pudieron registrar los pedidos: ${itemsError.message}`
    );
  }

  return {
    payoutId: payout.id,
    itemsCount: elegibles.length,
    storesCount: new Set(elegibles.map((e) => e.storeId)).size,
    totalAmount: total,
    descartados,
  };
}
