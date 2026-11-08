import {
  SIIGO_MAIL_SEND,
  SIIGO_NC_DOCUMENT_ID,
  SIIGO_NC_PAYMENT_TYPE,
  SIIGO_NC_USES_COST_CENTER,
  SIIGO_NC_REASON_FULL,
  SIIGO_NC_REASON_PARTIAL,
  SIIGO_STAMP_SEND,
} from '../config';
import type { SiigoCreditNoteItem, SiigoCreditNotePayload } from '../types';
import { SiigoDataError, todayInBogota } from './order-to-invoice';

/**
 * Arma la nota crédito de una devolución a partir de la factura que corrige.
 *
 * Función pura. Todo sale de lo que ya se guardó: los montos de la devolución
 * (`order_refunds`) y los códigos de producto de la factura tal como se envió
 * (`siigo_invoices.request_payload`). Así la nota usa exactamente los códigos
 * que Siigo ya aceptó, aunque el catálogo haya cambiado después.
 */

export interface CreditNoteContext {
  /** Código del caso (PQR-2026-000001). Es la clave de idempotencia. */
  pqrsCode: string;
  orderCode: string;
  /** Id de la factura en Siigo. */
  siigoInvoiceId: string;
  /** Lo que se envió al facturar: de ahí salen los códigos y el centro de costo. */
  invoiceRequest: {
    cost_center?: number;
    items: { code: string; description?: string; quantity: number; taxed_price?: number; price?: number }[];
  };
  scope: 'items' | 'order';
  products: number;
  serviceCommission: number;
  platformCommission: number;
  total: number;
  /** Líneas devueltas, con el código de Siigo de su producto. */
  items: { siigoCode: string | null; description: string; quantity: number; amount: number }[];
  /** Códigos de los conceptos de la factura, para ubicar esas líneas. */
  deliveryProductCode: string;
  thirdPartyProductCode: string;
  /** El de la antigua línea «Servicio MercaMesa»: solo para facturas viejas. */
  platformProductCode: string;
}

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

export function buildCreditNotePayload(ctx: CreditNoteContext): SiigoCreditNotePayload {
  if (!SIIGO_NC_DOCUMENT_ID) {
    throw new SiigoDataError(
      'Falta configurar el tipo de comprobante de nota crédito (SIIGO_NC_DOCUMENT_ID).'
    );
  }

  let items: SiigoCreditNoteItem[];

  if (ctx.scope === 'order') {
    // El pedido completo: se devuelve la factura entera, línea por línea. Sirve
    // igual para una factura vieja y una nueva.
    items = ctx.invoiceRequest.items.map((i) => ({
      code: i.code,
      description: i.description,
      quantity: i.quantity,
      price: money(i.taxed_price ?? i.price ?? 0),
    }));
  } else if (isThirdPartyInvoice(ctx)) {
    items = partialItemsThirdParty(ctx);
  } else {
    items = partialItemsLegacy(ctx);
  }

  const sumaFinal = money(items.reduce((s, i) => s + i.price * i.quantity, 0));
  if (sumaFinal !== money(ctx.total)) {
    // Una nota descuadrada es peor que ninguna: se detiene y queda el motivo.
    throw new SiigoDataError(
      `El total de la nota crédito ($${sumaFinal}) no coincide con el de la devolución ($${money(ctx.total)}).`
    );
  }

  const fecha = todayInBogota();

  return {
    document: { id: SIIGO_NC_DOCUMENT_ID },
    date: fecha,
    invoice: ctx.siigoInvoiceId,
    // Solo si el comprobante de nota crédito lo maneja: el de la cuenta no.
    ...(SIIGO_NC_USES_COST_CENTER && ctx.invoiceRequest.cost_center
      ? { cost_center: ctx.invoiceRequest.cost_center }
      : {}),
    reason: ctx.scope === 'order' ? SIIGO_NC_REASON_FULL : SIIGO_NC_REASON_PARTIAL,
    observations: `Devolución ${ctx.pqrsCode} del pedido ${ctx.orderCode} - Mercamesa`,
    stamp: { send: SIIGO_STAMP_SEND },
    mail: { send: SIIGO_MAIL_SEND },
    items,
    payments: [{ id: SIIGO_NC_PAYMENT_TYPE, value: money(ctx.total), due_date: fecha }],
  };
}

/**
 * ¿La factura se emitió con los dos conceptos (productos de terceros y
 * domicilio)? Las de antes llevaban un código por producto y una línea de
 * servicio: su nota crédito se arma igual que ellas.
 */
export function isThirdPartyInvoice(ctx: CreditNoteContext): boolean {
  return Boolean(ctx.thirdPartyProductCode) && ctx.invoiceRequest.items.some((i) => i.code === ctx.thirdPartyProductCode);
}

/** Absorbe los centavos del redondeo en una línea de cantidad 1, donde cualquier valor de dos decimales es exacto. */
function absorberRedondeo(items: SiigoCreditNoteItem[], total: number, preferida?: SiigoCreditNoteItem) {
  const suma = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const residuo = money(total - suma);
  const ajustable = preferida ?? items.find((i) => i.quantity === 1);
  if (residuo !== 0 && ajustable) ajustable.price = money(ajustable.price + residuo);
}

/**
 * Devolución parcial sobre una factura de dos conceptos: los productos devueltos
 * con el código de productos de terceros y su valor real, y en «Domicilio» lo
 * demás que se devuelve (gastos administrativos y, si aplica, el domicilio).
 */
function partialItemsThirdParty(ctx: CreditNoteContext): SiigoCreditNoteItem[] {
  const items: SiigoCreditNoteItem[] = ctx.items.map((i) => ({
    code: ctx.thirdPartyProductCode,
    description: i.description,
    quantity: i.quantity,
    price: money(i.amount / i.quantity),
  }));

  const productos = ctx.items.reduce((s, i) => s + i.amount, 0);
  const domicilio = money(ctx.total - productos);
  if (domicilio < 0) {
    throw new SiigoDataError(
      `La devolución ($${money(ctx.total)}) es menor que los productos devueltos ($${money(productos)}).`
    );
  }

  let lineaDomicilio: SiigoCreditNoteItem | undefined;
  if (domicilio > 0) {
    // El mismo código con que la factura llevó «Domicilio», aunque después se
    // haya cambiado en la parametrización.
    const code =
      ctx.invoiceRequest.items.find((i) => i.description === 'Domicilio')?.code || ctx.deliveryProductCode;
    if (!code) {
      throw new SiigoDataError('La devolución incluye gastos o domicilio y no hay código de Siigo para «Domicilio».');
    }
    lineaDomicilio = { code, description: 'Domicilio', quantity: 1, price: domicilio };
    items.push(lineaDomicilio);
  }

  absorberRedondeo(items, ctx.total, lineaDomicilio);
  return items;
}

/**
 * Devolución parcial sobre una factura vieja: la comisión de servicio iba
 * repartida dentro del precio de cada producto (con su propio código) y el
 * servicio MercaMesa en su línea. La nota corrige esa factura tal como se emitió.
 */
function partialItemsLegacy(ctx: CreditNoteContext): SiigoCreditNoteItem[] {
  const sinCodigo = ctx.items.filter((i) => !i.siigoCode);
  if (sinCodigo.length > 0) {
    throw new SiigoDataError(
      `${sinCodigo.length} producto(s) de la devolución no tienen código de Siigo: ${sinCodigo
        .map((i) => i.description)
        .join(', ')}.`
    );
  }

  const escala = ctx.products > 0 ? (ctx.products + ctx.serviceCommission) / ctx.products : 1;

  const items: SiigoCreditNoteItem[] = ctx.items.map((i) => ({
    code: i.siigoCode as string,
    description: i.description,
    quantity: i.quantity,
    // Precio unitario: Siigo multiplica por la cantidad.
    price: money((i.amount * escala) / i.quantity),
  }));

  let lineaServicio: SiigoCreditNoteItem | undefined;
  if (ctx.platformCommission > 0) {
    const code =
      ctx.invoiceRequest.items.find((i) => i.description === 'Servicio MercaMesa')?.code || ctx.platformProductCode;
    if (!code) {
      throw new SiigoDataError(
        'La devolución incluye la comisión de plataforma y no hay código de Siigo de la línea de servicio de la factura.'
      );
    }
    // La descripción es la de la factura que se corrige.
    lineaServicio = { code, description: 'Servicio MercaMesa', quantity: 1, price: money(ctx.platformCommission) };
    items.push(lineaServicio);
  }

  absorberRedondeo(items, ctx.total, lineaServicio);
  return items;
}
