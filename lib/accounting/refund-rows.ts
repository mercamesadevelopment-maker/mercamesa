import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { periodRange, type AccountingFilters } from './filters';
import { personInScope, storeInScope, type AccountingScope } from './scope';

/**
 * Las devoluciones (`order_refunds`) del periodo que cumplen el filtro, con su
 * pedido y su PQRS. Las usan las notas crédito (una por devolución) y el
 * listado de devoluciones en dinero.
 *
 * Son pocas, así que se leen las del periodo y se filtra en memoria por tienda y
 * cliente: la devolución trae su `store_id` y su `buyer_id`.
 */
export interface RefundRecord {
  id: string;
  /** Vacío en la devolución de una tienda que no cumplió su parte (`origin = 'store_cancel'`). */
  pqrs_id: string | null;
  store_id: string;
  buyer_id: string;
  total_amount: number | string;
  liable: string;
  method: string;
  status: string;
  money_reference: string | null;
  money_paid_at: string | null;
  money_paid_by: string | null;
  created_at: string;
  orders: { code: string | null } | null;
  pqrs: { code: string | null } | null;
}

export const REFUND_COLUMNS = `id, pqrs_id, store_id, buyer_id, total_amount, liable, method, status,
  money_reference, money_paid_at, money_paid_by, created_at,
  orders ( code ), pqrs ( code )`;

export async function loadRefunds(
  service: SupabaseClient<any>,
  filters: AccountingFilters,
  scope: AccountingScope,
  { method }: { method?: 'money' } = {}
): Promise<RefundRecord[]> {
  const periodo = periodRange(filters);
  const filas = (await fetchAllRows((from, to) => {
    let q = service.from('order_refunds').select(REFUND_COLUMNS);
    if (method) q = q.eq('method', method);
    if (periodo) q = q.gte('created_at', periodo.from).lt('created_at', periodo.to);
    return q.range(from, to);
  })) as unknown as RefundRecord[];

  return filas.filter((r) => storeInScope(scope, r.store_id) && personInScope(scope, r.buyer_id));
}

export function upperCode(code: string | null | undefined): string | null {
  return code ? code.toUpperCase() : null;
}
