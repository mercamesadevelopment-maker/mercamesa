import type { SupabaseClient } from '@supabase/supabase-js';
import { applyProductSearch, findSimilarProductIds } from '@/lib/search/server';

/**
 * El inventario de una tienda tal como lo ve el tendero: también lo que no está
 * publicado, sin precio o sin existencias. La vitrina (`storefront.ts`) solo
 * muestra lo publicado, y lo que el tendero más necesita tocar es justo lo otro:
 * los productos de grupo que la base le asigna sin publicar y en $0
 * (`asignar_productos_de_grupo`).
 *
 * Quien llama ya comprobó que la persona es de la tienda. Con el cliente de
 * servicio: el filtro por `store_id` es lo que la deja en su tienda.
 */

/** Qué mostrar además del texto. */
export type InventoryFilter = 'todos' | 'sin_publicar' | 'sin_precio' | 'sin_stock';

export const INVENTORY_PAGE_SIZE = 20;

export interface InventoryRow {
  id: string;
  code: string | null;
  price_per_unit: number | string | null;
  wholesale_price: number | string | null;
  wholesale_min_qty: number | string | null;
  stock: number | string | null;
  is_active: boolean | null;
  catalog_products: { name: string | null; categories: { name: string | null } | null } | null;
  measurement_units: { abbreviation: string | null } | null;
}

export interface InventoryItem {
  id: string;
  code: string | null;
  name: string;
  category: string | null;
  unit: string | null;
  price: number;
  wholesalePrice: number | null;
  wholesaleMin: number | null;
  stock: number;
  published: boolean;
  /** Sin precio no se puede publicar (`store_products_publicado_con_precio`). */
  needsPrice: boolean;
}

const num = (v: number | string | null): number | null => (v === null || v === undefined ? null : Number(v));

export function toInventoryItem(r: InventoryRow): InventoryItem {
  const price = num(r.price_per_unit) ?? 0;
  return {
    id: r.id,
    code: r.code,
    name: r.catalog_products?.name ?? 'Producto',
    category: r.catalog_products?.categories?.name ?? null,
    unit: r.measurement_units?.abbreviation ?? null,
    price,
    wholesalePrice: num(r.wholesale_price),
    wholesaleMin: num(r.wholesale_min_qty),
    stock: num(r.stock) ?? 0,
    published: r.is_active === true,
    needsPrice: !(price > 0),
  };
}

interface Filtrable<Q> {
  eq(columna: string, valor: unknown): Q;
  lte(columna: string, valor: unknown): Q;
}

/** El filtro, en la consulta. */
export function applyInventoryFilter<Q extends Filtrable<Q>>(query: Q, filtro: InventoryFilter): Q {
  switch (filtro) {
    case 'sin_publicar':
      return query.eq('is_active', false);
    case 'sin_precio':
      return query.lte('price_per_unit', 0);
    case 'sin_stock':
      return query.lte('stock', 0);
    default:
      return query;
  }
}

export async function searchStoreInventory(
  service: SupabaseClient<any>,
  storeId: string,
  opts: { text?: string; filter?: InventoryFilter; page?: number }
): Promise<{ items: InventoryItem[]; total: number; similar: boolean }> {
  const page = Math.max(opts.page ?? 1, 1);
  const from = (page - 1) * INVENTORY_PAGE_SIZE;
  const text = (opts.text ?? '').trim();

  const consultar = async (parecidos: string[] | null) => {
    let q = service
      .from('store_products')
      .select(
        `id, code, price_per_unit, wholesale_price, wholesale_min_qty, stock, is_active,
         catalog_products!inner ( name, categories ( name ) ),
         measurement_units ( abbreviation )`,
        { count: 'exact' }
      )
      .eq('store_id', storeId);
    if (parecidos) q = q.in('catalog_product_id', parecidos);
    else if (text) q = applyProductSearch(q, text, { text: 'search_text', phonetic: 'search_phonetic' }, 'catalog_products');
    q = applyInventoryFilter(q, opts.filter ?? 'todos');
    const { data, count, error } = await q.order('code').range(from, from + INVENTORY_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    return { rows: (data ?? []) as unknown as InventoryRow[], total: count ?? 0 };
  };

  let r = await consultar(null);
  let similar = false;
  // Como la vitrina: si lo escrito no encontró nada, lo que más se le parece («aguacte»).
  if (r.total === 0 && text) {
    const ids = await findSimilarProductIds(service, text);
    if (ids.length > 0) {
      r = await consultar(ids);
      similar = r.total > 0;
    }
  }
  return { items: r.rows.map(toInventoryItem), total: r.total, similar };
}
