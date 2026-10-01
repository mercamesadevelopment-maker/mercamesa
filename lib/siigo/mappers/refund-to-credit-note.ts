import {
  SIIGO_MAIL_SEND,
  SIIGO_NC_DOCUMENT_ID,
  SIIGO_NC_PAYMENT_TYPE,
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
  /** Códigos de los productos de servicio, para ubicar esas líneas en la factura. */
  deliveryProductCode: string;
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
    // El pedido completo: se devuelve la factura entera, línea por línea.
    items = ctx.invoiceRequest.items.map((i) => ({
      code: i.code,
      description: i.description,
      quantity: i.quantity,
      price: money(i.taxed_price ?? i.price ?? 0),
    }));
  } else {
    const sinCodigo = ctx.items.filter((i) => !i.siigoCode);
    if (sinCodigo.length > 0) {
      throw new SiigoDataError(
        `${sinCodigo.length} producto(s) de la devolución no tienen código de Siigo: ${sinCodigo
          .map((i) => i.description)
          .join(', ')}.`
      );
    }

    /**
     * En la factura, la comisión de servicio va repartida dentro del precio de
     * cada producto (no tiene línea propia) y el servicio MercaMesa sí va
     * aparte. La nota crédito sigue la misma forma: los productos devueltos
     * llevan su parte de la comisión de servicio, y el servicio MercaMesa
     * devuelto va en su línea.
     */
    const escala = ctx.products > 0 ? (ctx.products + ctx.serviceCommission) / ctx.products : 1;

    items = ctx.items.map((i) => ({
      code: i.siigoCode as string,
      description: i.description,
      quantity: i.quantity,
      // Precio unitario: Siigo multiplica por la cantidad.
      price: money((i.amount * escala) / i.quantity),
    }));

    if (ctx.platformCommission > 0) {
      if (!ctx.platformProductCode) {
        throw new SiigoDataError(
          'La devolución incluye servicio MercaMesa y no hay producto de Siigo configurado para él.'
        );
      }
      items.push({
        code: ctx.platformProductCode,
        description: 'Servicio MercaMesa',
        quantity: 1,
        price: money(ctx.platformCommission),
      });
    }

    // El redondeo del precio unitario deja centavos sueltos. Se absorben en una
    // línea de cantidad 1 —el servicio, o un producto de una sola unidad—, donde
    // cualquier valor de dos decimales es exacto. Igual que en la factura.
    const suma = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const residuo = money(ctx.total - suma);
    const ajustable =
      items.find((i) => i.code === ctx.platformProductCode && i.quantity === 1) ??
      items.find((i) => i.quantity === 1);
    if (residuo !== 0 && ajustable) {
      ajustable.price = money(ajustable.price + residuo);
    }
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
    ...(ctx.invoiceRequest.cost_center ? { cost_center: ctx.invoiceRequest.cost_center } : {}),
    reason: ctx.scope === 'order' ? SIIGO_NC_REASON_FULL : SIIGO_NC_REASON_PARTIAL,
    observations: `Devolución ${ctx.pqrsCode} del pedido ${ctx.orderCode} - Mercamesa`,
    stamp: { send: SIIGO_STAMP_SEND },
    mail: { send: SIIGO_MAIL_SEND },
    items,
    payments: [{ id: SIIGO_NC_PAYMENT_TYPE, value: money(ctx.total), due_date: fecha }],
  };
}
