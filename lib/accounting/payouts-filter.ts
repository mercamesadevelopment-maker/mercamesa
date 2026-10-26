import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllIn } from '@/lib/supabase/in-chunks';
import { isScoped, orderIdsInScope, type AccountingScope } from './scope';

/**
 * Las liquidaciones con alguna línea que cumple el filtro. `null` si no hay
 * filtro de tienda ni de cliente.
 *
 * - Por tienda o plaza: líneas de esas tiendas, incluidos sus descuentos por
 *   devolución.
 * - Por cliente: líneas de pedidos de ese cliente (los descuentos no tienen
 *   cliente propio).
 */
export async function payoutIdsInScope(
  service: SupabaseClient<any>,
  scope: AccountingScope
): Promise<string[] | null> {
  if (!isScoped(scope)) return null;

  let lineas: { payout_id: string }[];

  if (scope.buyerIds !== null) {
    const orderIds = (await orderIdsInScope(service, scope)) ?? [];
    const partes = await fetchAllIn<{ id: string; store_id: string }>(orderIds, (chunk, from, to) =>
      service.from('store_orders').select('id, store_id').in('order_id', chunk).range(from, to)
    );
    const partesEnTienda = partes.filter((p) => scope.storeIds === null || scope.storeIds.includes(p.store_id));
    lineas = await fetchAllIn(
      partesEnTienda.map((p) => p.id),
      (chunk, from, to) => service.from('payout_items').select('payout_id').in('store_order_id', chunk).range(from, to)
    );
  } else {
    lineas = await fetchAllIn(scope.storeIds ?? [], (chunk, from, to) =>
      service.from('payout_items').select('payout_id').in('store_id', chunk).range(from, to)
    );
  }

  return [...new Set(lineas.map((l) => l.payout_id))];
}
