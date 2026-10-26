/**
 * Qué se muestra de la factura de Siigo de un pedido, según quién mira.
 *
 * La respuesta de Siigo al crear la factura queda en
 * `siigo_invoices.response_payload` y trae `public_url` (la factura publicada)
 * y `name` (el número visible, "FV-1-123"). Mientras las facturas salgan sin
 * timbrar (`SIIGO_STAMP_SEND=false`) son borradores: no valen como factura
 * electrónica, así que el comprador no ve el enlace hasta que estén timbradas.
 * El admin sí, marcado como borrador.
 */

export type InvoiceViewer = 'buyer' | 'platform';

export interface OrderInvoiceLink {
  state: 'available' | 'processing';
  number: string | null;
  url: string | null;
  /** La factura existe en Siigo pero no está timbrada ante la DIAN. */
  draft: boolean;
}

/** Lo que se lee de `siigo_invoices`. */
export interface SiigoInvoiceRow {
  order_id: string;
  status: string;
  stamped: boolean;
  siigo_number: string | null;
  response_payload: unknown;
}

export const INVOICE_LINK_COLUMNS = 'order_id, status, stamped, siigo_number, response_payload';

export function invoiceLinkFor(row: SiigoInvoiceRow | null | undefined, viewer: InvoiceViewer): OrderInvoiceLink | null {
  // Sin fila o `skipped`: el pedido no se factura (p. ej. venta de mostrador).
  // `failed` se atiende desde la cola de Siigo, no desde el pedido.
  if (!row || row.status === 'skipped' || row.status === 'failed') return null;

  const payload = (row.response_payload ?? {}) as { public_url?: unknown; name?: unknown };
  const url = safeUrl(payload.public_url);
  const number = typeof payload.name === 'string' && payload.name ? payload.name : row.siigo_number;
  const processing: OrderInvoiceLink = { state: 'processing', number: null, url: null, draft: false };

  if (row.status !== 'sent' || !url) return processing;
  if (!row.stamped && viewer === 'buyer') return processing;

  return { state: 'available', number, url, draft: !row.stamped };
}

/** Solo un enlace `https`: no se pinta en la página cualquier cosa que venga en la respuesta. */
function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    return new URL(value).protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}
