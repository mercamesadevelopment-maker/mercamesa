import type { SupabaseClient } from '@supabase/supabase-js';
import {
  SIIGO_DELIVERY_PRODUCT_CODE,
  SIIGO_FV_DOCUMENT_ID,
  SIIGO_MAIL_SEND,
  SIIGO_SELLER_ID,
  SIIGO_STAMP_SEND,
  toSiigoPaymentTypeId,
} from '../config';
import type { BuyerForSiigo } from '../services/customer.service';
import type { SiigoInvoiceItem, SiigoInvoicePayload } from '../types';

/**
 * Error de datos: la factura no se puede armar porque falta información en la
 * base, no porque Siigo haya fallado. Se distingue para que el procesador lo
 * reporte con un motivo entendible en vez del error crudo de la API.
 *
 * Mismo patrón que `PiboxDataError` en lib/pibox/mappers/order-to-booking.ts.
 */
export class SiigoDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SiigoDataError';
  }
}

export interface OrderInvoiceContext {
  orderId: string;
  orderCode: string;
  total: number;
  deliveryFee: number;
  discount: number;
  paymentMethod: string | null;
  buyer: BuyerForSiigo;
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    siigoCode: string | null;
    syncedAt: string | null;
  }[];
}

/** Fecha de hoy en Bogotá. Siigo rechaza fechas futuras en factura electrónica. */
export function todayInBogota(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Carga todo lo que la factura necesita.
 *
 * `order_items` apunta a `store_products`, no al catálogo, así que el código de
 * Siigo exige el salto store_products → catalog_products → siigo_id.
 */
export async function loadOrderInvoiceContext(
  supabase: SupabaseClient<any>,
  orderId: string
): Promise<OrderInvoiceContext> {
  const { data: order, error } = await supabase
    .from('orders')
    .select(
      `id, code, total, delivery_fee, discount,
       profiles (
         document_number, full_name, business_name, contact_name, email, phone,
         identification_types ( siigo_id_type ),
         person_types ( requires_business_name )
       ),
       order_items (
         catalog_name, unit_name, quantity, unit_price,
         store_products ( catalog_products ( siigo_id, siigo_synced_at ) )
       ),
       payments ( status, payment_method )`
    )
    .eq('id', orderId)
    .single();

  if (error || !order) {
    throw new SiigoDataError(`No se encontró el pedido ${orderId}: ${error?.message ?? ''}`);
  }

  const profile = (order as any).profiles;
  if (!profile) {
    throw new SiigoDataError(
      'El pedido no tiene comprador registrado (se hizo como cliente de mostrador). No se puede facturar a un tercero.'
    );
  }

  const identification = (profile.document_number ?? '').trim();
  if (!identification) {
    throw new SiigoDataError(
      'El comprador no tiene número de identificación. Sin él Siigo no puede crear ni resolver el tercero.'
    );
  }

  const items = ((order as any).order_items ?? []).map((item: any) => {
    const catalog = item.store_products?.catalog_products;
    return {
      description: item.catalog_name,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unit_price),
      siigoCode: catalog?.siigo_id ?? null,
      syncedAt: catalog?.siigo_synced_at ?? null,
    };
  });

  if (items.length === 0) {
    throw new SiigoDataError('El pedido no tiene ítems.');
  }

  // Se toma el pago aprobado: es el que define con qué medio se pagó.
  const approvedPayment = ((order as any).payments ?? []).find(
    (p: any) => p.status === 'approved'
  );

  return {
    orderId: order.id,
    orderCode: order.code,
    total: Number(order.total),
    deliveryFee: Number(order.delivery_fee ?? 0),
    discount: Number(order.discount ?? 0),
    paymentMethod: approvedPayment?.payment_method ?? null,
    buyer: {
      identification,
      fullName: profile.full_name ?? null,
      businessName: profile.business_name ?? null,
      contactName: profile.contact_name ?? null,
      email: profile.email ?? null,
      phone: profile.phone ?? null,
      siigoIdType: profile.identification_types?.siigo_id_type ?? null,
      requiresBusinessName: Boolean(profile.person_types?.requires_business_name),
      addressLine: null,
    },
    items,
  };
}

/** Redondea a 2 decimales evitando el arrastre binario de los flotantes. */
function money(value: number): number {
  return Math.round(value * 100) / 100;
}

export function buildInvoicePayload(ctx: OrderInvoiceContext): SiigoInvoicePayload {
  const missing = ctx.items.filter((item) => !item.siigoCode);
  if (missing.length > 0) {
    throw new SiigoDataError(
      `${missing.length} producto(s) del pedido no tienen código de Siigo: ${missing
        .map((m) => m.description)
        .join(', ')}.`
    );
  }

  const notSynced = ctx.items.filter((item) => !item.syncedAt);
  if (notSynced.length > 0) {
    // Se detiene acá a propósito: Siigo respondería `invalid_code` y el motivo
    // real —que el producto nunca se subió— quedaría enterrado en el error crudo.
    throw new SiigoDataError(
      `${notSynced.length} producto(s) no están sincronizados con Siigo: ${notSynced
        .map((m) => m.description)
        .join(', ')}. Ejecuta la sincronización de productos antes de facturar.`
    );
  }

  const items: SiigoInvoiceItem[] = ctx.items.map((item) => ({
    code: item.siigoCode as string,
    description: item.description,
    quantity: item.quantity,
    // `taxed_price` = precio con IVA incluido. Mercamesa no guarda impuestos en
    // ninguna tabla, así que se envía lo que el comprador pagó y Siigo desagrega.
    taxed_price: money(item.unitPrice),
  }));

  // El domicilio se cobró al comprador, así que tiene que estar en la factura:
  // si no, el total no cuadraría con el pago y Siigo devolvería
  // `invalid_total_payments`.
  if (ctx.deliveryFee > 0) {
    if (!SIIGO_DELIVERY_PRODUCT_CODE) {
      throw new SiigoDataError(
        `El pedido cobró $${ctx.deliveryFee} de domicilio y no hay producto de Siigo configurado para facturarlo (SIIGO_DELIVERY_PRODUCT_CODE). Sin él la factura no cuadraría con el pago.`
      );
    }

    items.push({
      code: SIIGO_DELIVERY_PRODUCT_CODE,
      description: 'Domicilio',
      quantity: 1,
      taxed_price: money(ctx.deliveryFee),
    });
  }

  const itemsTotal = items.reduce(
    (sum, item) => sum + (item.taxed_price ?? 0) * item.quantity,
    0
  );

  // El descuento del pedido no se puede repartir por ítem sin inventar criterios,
  // así que si existe se detiene: emitir una factura descuadrada es peor que no
  // emitirla.
  if (money(itemsTotal) !== money(ctx.total)) {
    throw new SiigoDataError(
      `El total de los ítems ($${money(itemsTotal)}) no coincide con el total del pedido ($${money(
        ctx.total
      )}). Revisar descuentos o cargos que no se estén reflejando en la factura.`
    );
  }

  return {
    document: { id: SIIGO_FV_DOCUMENT_ID },
    date: todayInBogota(),
    customer: { identification: ctx.buyer.identification, branch_office: '0' },
    seller: SIIGO_SELLER_ID,
    stamp: { send: SIIGO_STAMP_SEND },
    mail: { send: SIIGO_MAIL_SEND },
    observations: `Pedido ${ctx.orderCode} - Mercamesa`,
    items,
    payments: [
      {
        id: toSiigoPaymentTypeId(ctx.paymentMethod),
        value: money(ctx.total),
      },
    ],
  };
}
