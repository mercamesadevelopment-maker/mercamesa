import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import {
  groupStoreClients,
  type ClientOrderItem,
  type ClientOrderPart,
  type ClientPerson,
  type ClientWithMetrics,
} from './store-clients';

/** Ids por consulta en un `.in(...)`: más largo y la URL de PostgREST se pasa del tope. */
const IN_CHUNK_SIZE = 100;

const PERSON_COLUMNS = 'id, full_name, document_number, email, phone, identification_types ( code )';

/**
 * Lee los pedidos de esas tiendas y arma sus clientes.
 *
 * Recibe el cliente de servicio: lee pedidos y datos de otras personas, así que
 * quien llama ya comprobó que puede ver esas tiendas.
 *
 * `includeClientsWithoutOrders` suma los clientes de mostrador que aún no
 * compran. Es para la vista de todas las tiendas de la plataforma: esos
 * clientes no son de ninguna tienda en particular.
 */
export async function loadStoreClients(
  service: SupabaseClient<any>,
  stores: { id: string; name: string }[],
  { includeClientsWithoutOrders = false } = {}
): Promise<ClientWithMetrics[]> {
  const storeIds = stores.map((s) => s.id);
  const storeNames = Object.fromEntries(stores.map((s) => [s.id, s.name]));

  const parts: ClientOrderPart[] = [];
  for (const chunk of chunks(storeIds)) {
    parts.push(
      ...((await fetchAllRows((from, to) =>
        service
          .from('store_orders')
          .select('id, order_id, store_id, code, subtotal, status, created_at, orders!inner ( buyer_id, client_id, payment_status )')
          .in('store_id', chunk)
          .order('created_at', { ascending: false })
          .range(from, to)
      )) as unknown as ClientOrderPart[])
    );
  }

  const orderIds = unique(parts.map((p) => p.order_id));
  const items: ClientOrderItem[] = [];
  for (const chunk of chunks(orderIds)) {
    items.push(
      ...((await fetchAllRows((from, to) =>
        service
          .from('order_items')
          .select('id, order_id, quantity, unit_price, catalog_name, unit_name, store_products ( store_id )')
          .in('order_id', chunk)
          .range(from, to)
      )) as unknown as ClientOrderItem[])
    );
  }

  const clientIds = unique(parts.map((p) => p.orders?.client_id));
  const buyerIds = unique(parts.map((p) => (p.orders?.client_id ? null : p.orders?.buyer_id)));

  const clients = includeClientsWithoutOrders
    ? ((await fetchAllRows((from, to) =>
        service.from('clients').select(`${PERSON_COLUMNS}, profile_id`).range(from, to)
      )) as unknown as ClientPerson[])
    : await selectByIds<ClientPerson>(service, 'clients', `${PERSON_COLUMNS}, profile_id`, clientIds);
  const profiles = await selectByIds<ClientPerson>(service, 'profiles', PERSON_COLUMNS, buyerIds);

  return groupStoreClients({ parts, items, clients, profiles, storeNames });
}

async function selectByIds<T>(
  service: SupabaseClient<any>,
  table: string,
  columns: string,
  ids: string[]
): Promise<T[]> {
  const rows: T[] = [];
  for (const chunk of chunks(ids)) {
    const { data, error } = await service.from(table).select(columns).in('id', chunk);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as T[]));
  }
  return rows;
}

function unique(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v)))];
}

function chunks(values: string[]): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < values.length; i += IN_CHUNK_SIZE) out.push(values.slice(i, i + IN_CHUNK_SIZE));
  return out;
}
