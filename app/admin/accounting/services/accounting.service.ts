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
