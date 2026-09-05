import { siigoFetch } from '../client';
import type { SiigoInvoicePayload, SiigoInvoiceResponse } from '../types';

/**
 * Crea una factura de venta en Siigo.
 *
 * `idempotencyKey` va como header `Idempotency-Key`: si la misma clave se
 * reenvía y el documento ya se creó, Siigo devuelve el comprobante anterior en
 * vez de emitir otro. Se usa `orders.code` (MM-2026-001017), que cumple el
 * límite de 30 caracteres alfanuméricos que exige Siigo.
 *
 * Es la segunda red de seguridad contra facturas duplicadas; la primera es el
 * `unique` sobre `siigo_invoices.order_id`.
 */
export async function createInvoice(
  payload: SiigoInvoicePayload,
  idempotencyKey?: string
): Promise<SiigoInvoiceResponse> {
  const headers: Record<string, string> = {};

  if (idempotencyKey) {
    // Solo letras y números: Siigo responde `invalid_idempotency_key` incluso
    // con guiones, así que "MM-2026-001017" se envía como "MM2026001017".
    // El límite son 30 caracteres.
    headers['Idempotency-Key'] = idempotencyKey.replace(/[^A-Za-z0-9]/g, '').slice(0, 30);
  }

  return siigoFetch<SiigoInvoiceResponse>('/v1/invoices', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
}

/** Consulta una factura ya creada. */
export function getInvoice(invoiceId: string): Promise<SiigoInvoiceResponse> {
  return siigoFetch<SiigoInvoiceResponse>(`/v1/invoices/${invoiceId}`);
}
