import type { SupabaseClient } from '@supabase/supabase-js';
import {
  SIIGO_DEFAULT_COST_CENTER_ID,
  SIIGO_DELIVERY_PRODUCT_CODE,
  SIIGO_FV_DOCUMENT_ID,
  SIIGO_MAIL_SEND,
  SIIGO_PLATFORM_PRODUCT_CODE,
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
  subtotal: number;
  deliveryFee: number;
  discount: number;
  /** Comisión de servicio (2,99%) cobrada al comprador. */
  serviceCommission: number;
  /** Mensajes de seguimiento cobrados al comprador. */
  messagesAmount: number;
  /** Comisión de plataforma (15% del neto). Va como línea propia en la factura. */
  platformCommission: number;
  paymentMethod: string | null;
  /** Centro de costo de la plaza donde se vendió. Siigo lo exige para la FV. */
  costCenterId: number;
  /** Códigos de Siigo con los que se facturan el domicilio y el servicio. */
  deliveryProductCode: string;
  platformProductCode: string;
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
      `id, code, total, subtotal, delivery_fee, discount,
       service_commission_amount, messages_amount, platform_commission_amount,
       profiles (
         document_number, full_name, business_name, contact_name, email, phone,
         identification_types ( siigo_id_type ),
         person_types ( requires_business_name )
       ),
       order_items (
         catalog_name, unit_name, quantity, unit_price,
         store_products ( catalog_products ( siigo_id, siigo_synced_at ) )
       ),
       payments ( status, payment_method ),
       store_orders ( stores ( marketplaces ( siigo_cost_center_id ) ) )`
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

  // Un pedido puede abarcar varias tiendas; se toma la plaza de la primera con
  // centro de costo mapeado. Con factura por pedido solo cabe uno.
  const costCenterId =
    ((order as any).store_orders ?? [])
      .map((so: any) => so.stores?.marketplaces?.siigo_cost_center_id)
      .find((id: number | null | undefined) => id != null) ?? SIIGO_DEFAULT_COST_CENTER_ID;

  // Los códigos de los productos de servicio se parametrizan desde la
  // plataforma; las variables de entorno quedan solo como respaldo para no
  // romper si la tabla de tarifas todavía no existe.
  const { data: pricingRow } = await supabase
    .from('pricing_settings_history')
    .select('siigo_delivery_product_code, siigo_platform_product_code')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    orderId: order.id,
    orderCode: order.code,
    total: Number(order.total),
    subtotal: Number(order.subtotal ?? 0),
    deliveryFee: Number(order.delivery_fee ?? 0),
    discount: Number(order.discount ?? 0),
    serviceCommission: Number((order as any).service_commission_amount ?? 0),
    messagesAmount: Number((order as any).messages_amount ?? 0),
    platformCommission: Number((order as any).platform_commission_amount ?? 0),
    deliveryProductCode:
      pricingRow?.siigo_delivery_product_code || SIIGO_DELIVERY_PRODUCT_CODE,
    platformProductCode:
      pricingRow?.siigo_platform_product_code || SIIGO_PLATFORM_PRODUCT_CODE,
    paymentMethod: approvedPayment?.payment_method ?? null,
    costCenterId,
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

  /**
   * La factura lleva tres clases de línea, según lo definió el cliente:
   *
   *   ÍTEM 1  producto + comisión 2,99% + mensajes  (una línea por producto)
   *   ÍTEM 2  domicilio
   *   ÍTEM 3  servicio MercaMesa (comisión de plataforma)
   *
   * Sin IVA en ninguna: según el tributarista del cliente, el impuesto se paga
   * en el momento de la dispersión de fondos, no en esta factura.
   */

  // El neto de compra se reparte entre los productos escalando cada línea, para
  // que el comprador siga viendo qué compró en vez de un total agregado. Los
  // mensajes se cobran por pedido, no por producto, así que el reparto es
  // proporcional al valor de cada línea.
  const netPurchase = ctx.subtotal + ctx.serviceCommission + ctx.messagesAmount;
  const scale = ctx.subtotal > 0 ? netPurchase / ctx.subtotal : 1;

  const items: SiigoInvoiceItem[] = ctx.items.map((item) => ({
    code: item.siigoCode as string,
    description: item.description,
    quantity: item.quantity,
    // `taxed_price` es el precio unitario. Se escala el unitario y no el total
    // de la línea porque Siigo multiplica por la cantidad.
    taxed_price: money(item.unitPrice * scale),
  }));

  // Se guardan las referencias para poder ajustar el redondeo más abajo sin
  // adivinar cuál línea es cuál.
  let deliveryLine: SiigoInvoiceItem | null = null;
  let platformLine: SiigoInvoiceItem | null = null;

  // El domicilio se cobró al comprador, así que tiene que estar en la factura:
  // si no, el total no cuadraría con el pago y Siigo devolvería
  // `invalid_total_payments`.
  if (ctx.deliveryFee > 0) {
    if (!ctx.deliveryProductCode) {
      throw new SiigoDataError(
        `El pedido cobró $${ctx.deliveryFee} de domicilio y no hay producto de Siigo configurado para facturarlo. Configúralo en Parametrización → Tarifas y Comisiones.`
      );
    }

    deliveryLine = {
      code: ctx.deliveryProductCode,
      description: 'Domicilio',
      quantity: 1,
      taxed_price: money(ctx.deliveryFee),
    };
    items.push(deliveryLine);
  }

  // Comisión de plataforma, como línea propia y con nombre entendible para el
  // comprador.
  if (ctx.platformCommission > 0) {
    if (!ctx.platformProductCode) {
      throw new SiigoDataError(
        `El pedido cobró $${ctx.platformCommission} de servicio MercaMesa y no hay producto de Siigo configurado para facturarlo. Configúralo en Parametrización → Tarifas y Comisiones.`
      );
    }

    platformLine = {
      code: ctx.platformProductCode,
      description: 'Servicio MercaMesa',
      quantity: 1,
      taxed_price: money(ctx.platformCommission),
    };
    items.push(platformLine);
  }

  /**
   * Ajuste del residuo de redondeo.
   *
   * Escalar el precio unitario y redondearlo a dos decimales deja una diferencia
   * de centavos que crece con la cantidad: 7 unidades pueden desviarse hasta
   * 3,5 centavos. No se puede corregir en la línea del producto, porque volver a
   * repartir el ajuste entre una cantidad fraccionaria reintroduce el mismo
   * error.
   *
   * Se absorbe entonces en una línea de cantidad 1 —el servicio o el domicilio—,
   * donde cualquier valor de dos decimales es exacto. Son centavos sobre un
   * concepto de Mercamesa, no sobre lo que se le liquida al tendero.
   */
  // Se prefiere el servicio sobre el domicilio: el domicilio es un valor que el
  // operador logístico cobra tal cual y conviene dejarlo intacto.
  const adjustable = platformLine ?? deliveryLine;

  const preAdjustTotal = items.reduce(
    (sum, item) => sum + (item.taxed_price ?? 0) * item.quantity,
    0
  );
  const residual = money(ctx.total - preAdjustTotal);
  if (residual !== 0 && adjustable) {
    adjustable.taxed_price = money((adjustable.taxed_price ?? 0) + residual);
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
    cost_center: ctx.costCenterId,
    items,
    payments: [
      {
        id: toSiigoPaymentTypeId(ctx.paymentMethod),
        value: money(ctx.total),
      },
    ],
  };
}
