import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { fetchAllIn } from '@/lib/supabase/in-chunks';
import { periodRange, type AccountingFilters } from './filters';
import { orderIdsInScope, type AccountingScope } from './scope';
import { loadPeopleNames, type StoresContext } from './context';
import { byDateDesc, paginate } from './paginate';
import type { Page, PaymentRow, PaymentTotals } from './types';

const PAYMENT_COLUMNS = 'id, order_id, provider, status, amount, payment_method_label, created_at';

/**
 * Los pagos de los compradores (`payments`): cada intento contra la pasarela, y
 * los pagos con saldo a favor. Un pedido rechazado y luego pagado tiene dos.
 */
export async function listPayments(
  service: SupabaseClient<any>,
  filters: AccountingFilters,
  scope: AccountingScope,
  stores: StoresContext,
  pageOpts: { page: number; pageSize: number }
): Promise<Page<PaymentRow, PaymentTotals>> {
  // `payments.created_at` es `timestamp` sin zona guardado en UTC.
  const periodo = periodRange(filters, { withZone: false });
  const orderIds = await orderIdsInScope(service, scope);

  const pagos =
    orderIds === null
      ? await fetchAllRows<any>((from, to) => {
          let q = service.from('payments').select(PAYMENT_COLUMNS);
          if (periodo) q = q.gte('created_at', periodo.from).lt('created_at', periodo.to);
          return q.range(from, to);
        })
      : await fetchAllIn<any>(orderIds, (chunk, from, to) => {
          let q = service.from('payments').select(PAYMENT_COLUMNS).in('order_id', chunk);
          if (periodo) q = q.gte('created_at', periodo.from).lt('created_at', periodo.to);
          return q.range(from, to);
        });

  const ids = pagos.map((p) => p.order_id);
  const [pedidos, partes] = await Promise.all([
    fetchAllIn<{ id: string; code: string | null; buyer_id: string | null; client_id: string | null }>(
      ids,
      (chunk, from, to) => service.from('orders').select('id, code, buyer_id, client_id').in('id', chunk).range(from, to)
    ),
    fetchAllIn<{ order_id: string; store_id: string }>(ids, (chunk, from, to) =>
      service.from('store_orders').select('order_id, store_id').in('order_id', chunk).range(from, to)
    ),
  ]);
  const pedidoPor = new Map(pedidos.map((o) => [o.id, o]));
  const tiendasPor = new Map<string, string[]>();
  for (const p of partes) tiendasPor.set(p.order_id, [...(tiendasPor.get(p.order_id) ?? []), p.store_id]);
  const nombres = await loadPeopleNames(
    service,
    pedidos.map((o) => o.buyer_id),
    pedidos.map((o) => o.client_id)
  );

  const rows: PaymentRow[] = pagos
    .map((p) => {
      const pedido = pedidoPor.get(p.order_id);
      const tiendas = tiendasPor.get(p.order_id) ?? [];
      const persona = pedido?.client_id ?? pedido?.buyer_id;
      return {
        id: p.id,
        // Sin zona en la base: se marca UTC para que el navegador lo convierta bien.
        createdAt: `${String(p.created_at).replace(' ', 'T').slice(0, 19)}Z`,
        orderId: p.order_id,
        orderCode: pedido?.code ? pedido.code.toUpperCase() : null,
        buyerName: persona ? nombres.get(persona) ?? null : null,
        storeNames: uniqueNames(tiendas.map((id) => stores.storeName(id))),
        marketplaceNames: uniqueNames(tiendas.map((id) => stores.marketplaceOf(id))),
        provider: p.provider,
        method: p.payment_method_label,
        status: p.status,
        amount: Number(p.amount),
      };
    })
    .sort(byDateDesc);

  return paginate(rows, paymentTotals(rows), pageOpts);
}

export function paymentTotals(rows: Pick<PaymentRow, 'status' | 'amount'>[]): PaymentTotals {
  const aprobados = rows.filter((r) => r.status === 'approved');
  const otros = rows.filter((r) => r.status !== 'approved');
  return {
    approved: aprobados.reduce((s, r) => s + r.amount, 0),
    approvedCount: aprobados.length,
    notApproved: otros.reduce((s, r) => s + r.amount, 0),
    notApprovedCount: otros.length,
  };
}

function uniqueNames(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v)))];
}
