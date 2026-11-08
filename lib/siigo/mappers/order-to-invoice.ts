import type { SupabaseClient } from '@supabase/supabase-js';
import {
  SIIGO_DEFAULT_COST_CENTER_ID,
  SIIGO_DELIVERY_PRODUCT_CODE,
  SIIGO_FV_DOCUMENT_ID,
  SIIGO_MAIL_SEND,
  SIIGO_PAYMENT_TYPE_CREDIT,
  SIIGO_SELLER_ID,
  SIIGO_THIRD_PARTY_PRODUCT_CODE,
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
  /** Comisión de plataforma (15% del neto). En la factura va dentro de «Domicilio». */
  platformCommission: number;
  paymentMethod: string | null;
  /** Lo que el comprador pagó con saldo a favor. El resto entró por la pasarela. */
  creditApplied: number;
  /** Centro de costo de la plaza donde se vendió. Siigo lo exige para la FV. */
  costCenterId: number;
  /** Códigos de Siigo de los dos conceptos de la factura. */
  deliveryProductCode: string;
  thirdPartyProductCode: string;
  buyer: BuyerForSiigo;
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
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
      `id, code, total, subtotal, delivery_fee, discount, credit_applied,
       service_commission_amount, messages_amount, platform_commission_amount,
       profiles (
         document_number, full_name, business_name, contact_name, email, phone,
         identification_types ( siigo_id_type ),
         person_types ( requires_business_name )
       ),
       order_items ( catalog_name, unit_name, quantity, unit_price ),
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

  const items = ((order as any).order_items ?? []).map((item: any) => ({
    description: item.catalog_name,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unit_price),
  }));

  if (items.length === 0) {
    throw new SiigoDataError('El pedido no tiene ítems.');
  }

  // Se toma el pago aprobado: es el que define con qué medio se pagó. Si hay
  // uno de la pasarela se prefiere sobre el de saldo: en un pago mixto, el saldo
  // va aparte, por `creditApplied`.
  const aprobados = ((order as any).payments ?? []).filter((p: any) => p.status === 'approved');
  const approvedPayment =
    aprobados.find((p: any) => p.payment_method !== 'credit') ?? aprobados[0];

  // Un pedido puede abarcar varias tiendas; se toma la plaza de la primera con
  // centro de costo mapeado. Con factura por pedido solo cabe uno.
  const costCenterId =
    ((order as any).store_orders ?? [])
      .map((so: any) => so.stores?.marketplaces?.siigo_cost_center_id)
      .find((id: number | null | undefined) => id != null) ?? SIIGO_DEFAULT_COST_CENTER_ID;

  // Los códigos de los dos conceptos se parametrizan desde la plataforma; las
  // variables de entorno quedan solo como respaldo.
  const { data: pricingRow } = await supabase
    .from('pricing_settings_history')
    .select('siigo_delivery_product_code, siigo_third_party_product_code')
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
    thirdPartyProductCode:
      pricingRow?.siigo_third_party_product_code || SIIGO_THIRD_PARTY_PRODUCT_CODE,
    paymentMethod: approvedPayment?.payment_method ?? null,
    creditApplied: Number((order as any).credit_applied ?? 0),
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

/** Lo que va en la línea «Domicilio» con lo que cobró el pedido, sin redondeo. */
export function mercamesaCharges(ctx: Pick<OrderInvoiceContext, 'deliveryFee' | 'serviceCommission' | 'messagesAmount' | 'platformCommission'>): number {
  return ctx.deliveryFee + ctx.serviceCommission + ctx.messagesAmount + ctx.platformCommission;
}

/** Diferencia máxima, en pesos, que se acepta como redondeo entre lo cobrado y la factura. */
const TOLERANCIA_REDONDEO = 1;

export function buildInvoicePayload(ctx: OrderInvoiceContext): SiigoInvoicePayload {
  /**
   * La factura lleva dos conceptos, definidos con los contadores:
   *
   *   PRODUCTOS DE TERCEROS  una línea por producto, con su nombre y su precio
   *                          real, todas con el mismo código de Siigo. Es lo
   *                          del tendero.
   *   DOMICILIO              una línea con todo lo de MercaMesa: el domicilio,
   *                          los gastos administrativos (2,99 % y 15 %) y los
   *                          gastos operativos (mensajes).
   *
   * No hay línea de «servicio»: un servicio lleva IVA. Sin IVA en ninguna: según
   * el tributarista del cliente, el impuesto se paga en la dispersión de fondos.
   */
  if (!ctx.thirdPartyProductCode) {
    throw new SiigoDataError(
      'No hay código de Siigo para «Productos de terceros». Configúralo en Parametrización → Tarifas y Comisiones.'
    );
  }

  const items: SiigoInvoiceItem[] = ctx.items.map((item) => ({
    code: ctx.thirdPartyProductCode,
    description: item.description,
    quantity: item.quantity,
    // `taxed_price` es el precio unitario: Siigo multiplica por la cantidad.
    taxed_price: money(item.unitPrice),
  }));

  const productos = items.reduce((sum, item) => sum + (item.taxed_price ?? 0) * item.quantity, 0);

  // «Domicilio» es el total menos los productos: así absorbe los centavos del
  // redondeo y la factura cuadra con el pago. Pero tiene que corresponder a lo
  // que se cobró: si no (un descuento del pedido, un cargo que no se refleja),
  // se detiene antes que esconder la diferencia dentro del domicilio.
  const domicilio = money(ctx.total - productos);
  const cobrado = money(mercamesaCharges(ctx));
  if (Math.abs(domicilio - cobrado) > TOLERANCIA_REDONDEO) {
    throw new SiigoDataError(
      `El total del pedido ($${money(ctx.total)}) no cuadra con los productos ($${money(productos)}) más el domicilio y los gastos ($${cobrado}). Revisar descuentos o cargos que no se estén reflejando en la factura.`
    );
  }

  if (domicilio > 0) {
    // Se cobró al comprador, así que tiene que estar en la factura: si no, el
    // total no cuadraría con el pago y Siigo devolvería `invalid_total_payments`.
    if (!ctx.deliveryProductCode) {
      throw new SiigoDataError(
        `El pedido cobró $${domicilio} de domicilio y gastos y no hay código de Siigo para «Domicilio». Configúralo en Parametrización → Tarifas y Comisiones.`
      );
    }
    items.push({ code: ctx.deliveryProductCode, description: 'Domicilio', quantity: 1, taxed_price: domicilio });
  }

  const itemsTotal = items.reduce((sum, item) => sum + (item.taxed_price ?? 0) * item.quantity, 0);
  if (money(itemsTotal) !== money(ctx.total)) {
    throw new SiigoDataError(
      `El total de los ítems ($${money(itemsTotal)}) no coincide con el total del pedido ($${money(
        ctx.total
      )}). Revisar descuentos o cargos que no se estén reflejando en la factura.`
    );
  }

  const invoiceDate = todayInBogota();

  return {
    document: { id: SIIGO_FV_DOCUMENT_ID },
    date: invoiceDate,
    customer: { identification: ctx.buyer.identification, branch_office: '0' },
    seller: SIIGO_SELLER_ID,
    stamp: { send: SIIGO_STAMP_SEND },
    mail: { send: SIIGO_MAIL_SEND },
    observations: `Pedido ${ctx.orderCode} - Mercamesa`,
    cost_center: ctx.costCenterId,
    items,
    payments: [
      // La parte pagada con saldo a favor va con su propia forma de pago; así
      // los pagos de la factura siguen sumando el total.
      ...(ctx.creditApplied > 0 && ctx.creditApplied < ctx.total
        ? [{ id: SIIGO_PAYMENT_TYPE_CREDIT, value: money(ctx.creditApplied), due_date: invoiceDate }]
        : []),
      {
        id: toSiigoPaymentTypeId(ctx.paymentMethod),
        value: money(ctx.creditApplied < ctx.total ? ctx.total - ctx.creditApplied : ctx.total),
        /**
         * Obligatorio para los tipos de pago a crédito.
         *
         * Los pagos por PSE llegan con `payment_method = 'unknown'` (ZonaPagos no
         * lo discrimina) y caen en "Clientes Nacionales" (6542), que es una
         * cuenta por cobrar y exige vencimiento: sin este campo Siigo responde
         * `parameter_required: payments[0].due_date`.
         *
         * Va con la fecha de la factura porque el comprador ya pagó: el pedido
         * solo se factura después de que el pago quedó aprobado, así que no hay
         * plazo pendiente.
         */
        due_date: invoiceDate,
      },
    ],
  };
}
