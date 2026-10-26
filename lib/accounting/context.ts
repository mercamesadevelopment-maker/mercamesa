import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { fetchAllIn } from '@/lib/supabase/in-chunks';
import type { AccountingOptions } from './types';

/**
 * Nombres para mostrar en los listados: tiendas, plazas y personas. Las tiendas
 * y plazas son pocas y se leen completas; las personas, solo las que aparecen.
 */

export interface StoresContext {
  storeName: (id: string | null | undefined) => string | null;
  marketplaceOf: (storeId: string | null | undefined) => string | null;
  options: AccountingOptions;
}

export async function loadStoresContext(service: SupabaseClient<any>): Promise<StoresContext> {
  const [stores, marketplaces] = await Promise.all([
    fetchAllRows<{ id: string; name: string; marketplace_id: string | null }>((from, to) =>
      service.from('stores').select('id, name, marketplace_id').order('name').range(from, to)
    ),
    fetchAllRows<{ id: string; name: string }>((from, to) =>
      service.from('marketplaces').select('id, name').order('name').range(from, to)
    ),
  ]);

  const storeById = new Map(stores.map((s) => [s.id, s]));
  const marketplaceById = new Map(marketplaces.map((m) => [m.id, m.name]));

  return {
    storeName: (id) => (id ? storeById.get(id)?.name ?? null : null),
    marketplaceOf: (storeId) => {
      const mp = storeId ? storeById.get(storeId)?.marketplace_id : null;
      return mp ? marketplaceById.get(mp) ?? null : null;
    },
    options: {
      stores: stores.map((s) => ({ id: s.id, name: s.name, marketplaceId: s.marketplace_id })),
      marketplaces,
    },
  };
}

/**
 * El nombre de cada persona: compradores con cuenta (`profiles`) y clientes de
 * mostrador (`clients`), en un solo mapa por id.
 */
export async function loadPeopleNames(
  service: SupabaseClient<any>,
  profileIds: (string | null | undefined)[],
  clientIds: (string | null | undefined)[] = []
): Promise<Map<string, string>> {
  const ids = (values: (string | null | undefined)[]) => values.filter((v): v is string => Boolean(v));
  const [profiles, clients] = await Promise.all([
    fetchAllIn<{ id: string; full_name: string | null }>(ids(profileIds), (chunk, from, to) =>
      service.from('profiles').select('id, full_name').in('id', chunk).range(from, to)
    ),
    fetchAllIn<{ id: string; full_name: string | null }>(ids(clientIds), (chunk, from, to) =>
      service.from('clients').select('id, full_name').in('id', chunk).range(from, to)
    ),
  ]);
  return new Map([...profiles, ...clients].map((p) => [p.id, p.full_name?.trim() || 'Sin nombre']));
}
