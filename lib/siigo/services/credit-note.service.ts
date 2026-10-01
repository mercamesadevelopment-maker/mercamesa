import { siigoFetch } from '../client';
import type { SiigoCreditNotePayload, SiigoCreditNoteResponse } from '../types';

/**
 * Crea una nota crédito en Siigo.
 *
 * `idempotencyKey` cumple el mismo papel que en `createInvoice`: si el reintento
 * llega después de que Siigo ya creó el comprobante, devuelve el existente en
 * vez de emitir otro. Solo letras y números, máximo 30.
 */
export async function createCreditNote(
  payload: SiigoCreditNotePayload,
  idempotencyKey?: string
): Promise<SiigoCreditNoteResponse> {
  const headers: Record<string, string> = {};

  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey.replace(/[^A-Za-z0-9]/g, '').slice(0, 30);
  }

  return siigoFetch<SiigoCreditNoteResponse>('/v1/credit-notes', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
}
