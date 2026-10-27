import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { invoiceLinkFor } from '@/lib/siigo/invoice-link';
import { periodRange, type AccountingFilters } from './filters';
import { personInScope, storeInScope, type AccountingScope } from './scope';
import { loadPeopleNames, type StoresContext } from './context';
import { byDateDesc, paginate } from './paginate';
import { REFUND_COLUMNS, upperCode, type RefundRecord } from './refund-rows';
import type { CreditNoteRow, CreditNoteTotals, Page } from './types';

/**
 * Las notas crédito de Siigo: una por devolución, sea en saldo a favor o en
 * dinero. El periodo es el de la nota, no el de la devolución.
 */
export async function listCreditNotes(
  service: SupabaseClient<any>,
  filters: AccountingFilters,
  scope: AccountingScope,
  stores: StoresContext,
  pageOpts: { page: number; pageSize: number }
): Promise<Page<CreditNoteRow, CreditNoteTotals>> {
  const periodo = periodRange(filters);
  const notas = (
    await fetchAllRows<any>((from, to) => {
      let q = service
        .from('siigo_credit_notes')
        .select(`id, status, stamped, siigo_number, response_payload, last_error, created_at, order_refunds!inner ( ${REFUND_COLUMNS} )`);
      if (periodo) q = q.gte('created_at', periodo.from).lt('created_at', periodo.to);
      return q.range(from, to);
    })
  ).filter((n) => {
    const r = n.order_refunds as RefundRecord;
    return storeInScope(scope, r.store_id) && personInScope(scope, r.buyer_id);
  });

  const nombres = await loadPeopleNames(
    service,
    notas.map((n) => n.order_refunds.buyer_id)
  );

  const rows: CreditNoteRow[] = notas
    .map((n) => {
      const r = n.order_refunds as RefundRecord;
      return {
        id: n.id,
        createdAt: n.created_at,
        // Misma regla que la factura: enlace solo `https`, y marcado como
        // borrador si no está timbrada. Contabilidad es de la plataforma.
        document: invoiceLinkFor(
          { order_id: r.id, status: n.status, stamped: n.stamped, siigo_number: n.siigo_number, response_payload: n.response_payload },
          'platform'
        ),
        status: n.status,
        lastError: n.last_error,
        orderCode: upperCode(r.orders?.code),
        pqrsCode: upperCode(r.pqrs?.code),
        buyerName: nombres.get(r.buyer_id) ?? null,
        storeName: stores.storeName(r.store_id),
        marketplaceName: stores.marketplaceOf(r.store_id),
        amount: Number(r.total_amount),
        liable: r.liable,
      };
    })
    .sort(byDateDesc);

  return paginate(rows, creditNoteTotals(rows), pageOpts);
}

export function creditNoteTotals(rows: Pick<CreditNoteRow, 'status' | 'amount'>[]): CreditNoteTotals {
  return {
    amount: rows.reduce((s, r) => s + r.amount, 0),
    sent: rows.filter((r) => r.status === 'sent').length,
    pending: rows.filter((r) => r.status === 'pending').length,
    failed: rows.filter((r) => r.status === 'failed').length,
  };
}
