import type {
  AccountingOptions,
  CreditNoteRow,
  CreditNoteTotals,
  Page,
  PaymentRow,
  PaymentTotals,
  RefundRow,
  RefundTotals,
} from '@/lib/accounting/types';
import type { BalanceReport } from '@/lib/accounting/test-balance';

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error || 'No se pudo cargar la información.');
  return result.data as T;
}

export const fetchAccountingOptions = () => getJson<AccountingOptions>('/api/admin/accounting/options');

export const fetchPayments = (query: string) =>
  getJson<Page<PaymentRow, PaymentTotals>>(`/api/admin/accounting/payments${query}`);

export const fetchCreditNotes = (query: string) =>
  getJson<Page<CreditNoteRow, CreditNoteTotals>>(`/api/admin/accounting/credit-notes${query}`);

export const fetchMoneyRefunds = (query: string) =>
  getJson<Page<RefundRow, RefundTotals>>(`/api/admin/accounting/refunds${query}`);

export const fetchBalanceReports = () => getJson<BalanceReport[]>('/api/admin/accounting/test-balance');

export const searchSiigoBuyersService = (q: string) =>
  getJson<{ name: string; identification: string }[]>(
    `/api/admin/accounting/test-balance/third-parties?q=${encodeURIComponent(q)}`
  );

/** Error al generar un balance, con el código para distinguir «este entorno no tiene Siigo». */
export class BalanceError extends Error {
  constructor(message: string, readonly code: string | null) {
    super(message);
  }
}

/** Pide el balance a Siigo. Devuelve la fila nueva del historial. */
export async function generateBalanceService(body: Record<string, unknown>): Promise<BalanceReport> {
  const response = await fetch('/api/admin/accounting/test-balance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new BalanceError(result?.error || 'No se pudo generar el balance.', result?.code ?? null);
  return result.data as BalanceReport;
}

/** Deja la constancia de que una devolución en dinero ya se pagó. */
export async function markRefundPaidService(id: string, reference: string): Promise<void> {
  const response = await fetch(`/api/admin/accounting/refunds/${id}/paid`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reference }),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result?.error || 'No se pudo registrar el pago.');
  }
}
