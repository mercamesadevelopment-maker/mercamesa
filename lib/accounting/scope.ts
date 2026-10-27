import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { fetchAllIn } from '@/lib/supabase/in-chunks';
import { sanitizeSearch, type AccountingFilters } from './filters';

/**
 * A qué tiendas y personas se reducen los filtros de cliente, tienda y plaza.
 *
 * `null` en un campo es «sin restricción». Una lista vacía es «nada cumple»: un
 * cliente que no existe o una plaza sin tiendas dejan el listado vacío, no
 * completo.
 */
export interface AccountingScope {
  storeIds: string[] | null;
  /** Compradores con cuenta (`profiles`). */
  buyerIds: string[] | null;
  /** Clientes de mostrador (`clients`). Van junto a `buyerIds` cuando se busca un cliente. */
  clientIds: string[] | null;
}

export async function resolveAccountingScope(
  service: SupabaseClient<any>,
  f: AccountingFilters
): Promise<AccountingScope> {
  let storeIds: string[] | null = f.storeId ? [f.storeId] : null;

  if (f.marketplaceId) {
    const { data, error } = await service.from('stores').select('id').eq('marketplace_id', f.marketplaceId);
    if (error) throw new Error(error.message);
    const deLaPlaza = (data ?? []).map((s) => s.id);
    storeIds = storeIds ? storeIds.filter((id) => deLaPlaza.includes(id)) : deLaPlaza;
  }

  let buyerIds: string[] | null = null;
  let clientIds: string[] | null = null;
  const q = f.buyerQuery ? sanitizeSearch(f.buyerQuery) : '';
  if (f.buyerQuery) {
    const like = `%${q}%`;
    const or = `full_name.ilike.${like},document_number.ilike.${like},email.ilike.${like}`;
    const [profiles, clients] = q
      ? await Promise.all([
          fetchAllRows<{ id: string }>((from, to) => service.from('profiles').select('id').or(or).range(from, to)),
          fetchAllRows<{ id: string }>((from, to) => service.from('clients').select('id').or(or).range(from, to)),
        ])
      : [[], []];
    buyerIds = profiles.map((p) => p.id);
    clientIds = clients.map((c) => c.id);
  }

  return { storeIds, buyerIds, clientIds };
}

export function isScoped(scope: AccountingScope): boolean {
  return scope.storeIds !== null || scope.buyerIds !== null;
}

/** Si una persona (comprador o cliente de mostrador) entra en el filtro de cliente. */
export function personInScope(
  scope: AccountingScope,
  buyerId: string | null | undefined,
  clientId?: string | null
): boolean {
  if (scope.buyerIds === null) return true;
  return Boolean(
    (buyerId && scope.buyerIds.includes(buyerId)) || (clientId && scope.clientIds?.includes(clientId))
  );
}

export function storeInScope(scope: AccountingScope, storeId: string | null | undefined): boolean {
  return scope.storeIds === null || Boolean(storeId && scope.storeIds.includes(storeId));
}

/**
 * Los pedidos que cumplen el filtro de cliente y de tienda. `null` si no hay
 * ninguno de los dos filtros.
 */
export async function orderIdsInScope(
  service: SupabaseClient<any>,
  scope: AccountingScope
): Promise<string[] | null> {
  if (!isScoped(scope)) return null;

  let ids: Set<string> | null = null;

  if (scope.buyerIds !== null) {
    const [deCompradores, deClientes] = await Promise.all([
      fetchAllIn<{ id: string }>(scope.buyerIds, (chunk, from, to) =>
        service.from('orders').select('id').in('buyer_id', chunk).range(from, to)
      ),
      fetchAllIn<{ id: string }>(scope.clientIds ?? [], (chunk, from, to) =>
        service.from('orders').select('id').in('client_id', chunk).range(from, to)
      ),
    ]);
    ids = new Set([...deCompradores, ...deClientes].map((o) => o.id));
  }

  if (scope.storeIds !== null) {
    const partes = await fetchAllIn<{ order_id: string }>(scope.storeIds, (chunk, from, to) =>
      service.from('store_orders').select('order_id').in('store_id', chunk).range(from, to)
    );
    const deTiendas = new Set(partes.map((p) => p.order_id));
    ids = ids ? new Set([...ids].filter((id) => deTiendas.has(id))) : deTiendas;
  }

  return [...(ids ?? [])];
}
