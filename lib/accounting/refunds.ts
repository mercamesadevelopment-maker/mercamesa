import type { SupabaseClient } from '@supabase/supabase-js';
import type { AccountingFilters } from './filters';
import type { AccountingScope } from './scope';
import { loadPeopleNames, type StoresContext } from './context';
import { byDateDesc, paginate } from './paginate';
import { loadRefunds, upperCode } from './refund-rows';
import type { Page, RefundRow, RefundTotals } from './types';

/**
 * Las devoluciones en dinero: las que el comprador pidió en plata y no en saldo
 * a favor. Se pagan por fuera (transferencia) y aquí queda la constancia.
 */
export async function listMoneyRefunds(
  service: SupabaseClient<any>,
  filters: AccountingFilters,
  scope: AccountingScope,
  stores: StoresContext,
  pageOpts: { page: number; pageSize: number }
): Promise<Page<RefundRow, RefundTotals>> {
  const refunds = (await loadRefunds(service, filters, scope, { method: 'money' })).filter(
    (r) => r.status === 'money_pending' || r.status === 'money_paid'
  );
  const nombres = await loadPeopleNames(service, [
    ...refunds.map((r) => r.buyer_id),
    ...refunds.map((r) => r.money_paid_by),
  ]);

  const rows: RefundRow[] = refunds
    .map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      orderCode: upperCode(r.orders?.code),
      pqrsCode: upperCode(r.pqrs?.code),
      buyerName: nombres.get(r.buyer_id) ?? null,
      storeName: stores.storeName(r.store_id),
      marketplaceName: stores.marketplaceOf(r.store_id),
      amount: Number(r.total_amount),
      status: r.status as RefundRow['status'],
      reference: r.money_reference,
      paidAt: r.money_paid_at,
      paidByName: r.money_paid_by ? nombres.get(r.money_paid_by) ?? null : null,
    }))
    .sort(byDateDesc);

  return paginate(rows, refundTotals(rows), pageOpts);
}

export function refundTotals(rows: Pick<RefundRow, 'status' | 'amount'>[]): RefundTotals {
  const pendientes = rows.filter((r) => r.status === 'money_pending');
  const pagadas = rows.filter((r) => r.status === 'money_paid');
  return {
    pending: pendientes.reduce((s, r) => s + r.amount, 0),
    pendingCount: pendientes.length,
    paid: pagadas.reduce((s, r) => s + r.amount, 0),
    paidCount: pagadas.length,
  };
}
