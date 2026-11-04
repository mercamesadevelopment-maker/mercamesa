import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database_generated';
import { getSupabaseImageUrl, PRESET_PRODUCT_CARD } from '@/lib/supabase/supabase-image';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { embeddedCount } from '@/lib/db/embedded-count';

/**
 * Gestión y catálogo: las columnas completas, incluidos los inactivos y el
 * precio mayorista.
 *
 * `withOrderCount` (gestión) decide si viaja además el conteo de pedidos.
 * `order_items` es la ÚNICA clave foránea que impide borrar un producto
 * —carritos, movimientos de stock y ofertas van en cascada y se destruyen sin
 * avisar—, así que con ese número la pantalla puede decirle al tendero qué va a
 * pasar ANTES de que haga clic. A quien solo mira el catálogo no le incumbe.
 *
 * Un error de la consulta se lanza con el mensaje de PostgREST.
 */
export async function listForManagement(
  supabase: SupabaseClient<Database>,
  params: URLSearchParams,
  storeId: string | null,
  withOrderCount: boolean
) {
  const search = (params.get('search') || '').trim();
  // Tope opcional, para el desplegable de ofertas: sin él se devuelve todo, como
  // siempre.
  const limit = Math.min(Math.max(Number(params.get('limit')) || 0, 0), 500);

  const construirConsulta = (from: number, to: number) => {
    // Los dos `select` van escritos enteros y no armados con una plantilla
    // porque supabase-js analiza la consulta en tiempo de compilación: con un
    // trozo interpolado pierde los tipos de todo el resultado.
    //
    // `catalog_products!inner` para poder filtrar por su `search_text`. No
    // cambia ningún resultado: `catalog_product_id` es NOT NULL y no hay
    // huérfanos.
    let query = withOrderCount
      ? supabase.from('store_products').select(`
          *,
          catalog_products!inner ( name, image_url, description, category_id, review_status, categories ( id, name, parent_id ) ),
          stores!inner ( name, slug, is_active, marketplaces ( name ) ),
          measurement_units ( abbreviation ),
          order_items ( count )
        `)
      : supabase.from('store_products').select(`
          *,
          catalog_products!inner ( name, image_url, description, category_id, categories ( id, name, parent_id ) ),
          stores!inner ( name, slug, is_active, marketplaces ( name ) ),
          measurement_units ( abbreviation )
        `);

    if (storeId) query = query.eq('store_id', storeId);
    if (search) query = query.ilike('catalog_products.search_text', `%${search}%`);

    return query
      .order('is_featured', { ascending: false })
      .order('featured_at', { ascending: false })
      .range(from, to);
  };

  let data: any[];

  if (limit > 0) {
    const { data: filas, error } = await construirConsulta(0, limit - 1);
    if (error) throw new Error(error.message);
    data = filas ?? [];
  } else {
    // Sin esto se perdían filas en silencio: la tienda más grande tiene 2.233
    // productos y solo llegaban 1.000.
    data = await fetchAllRows<any>((from, to) => construirConsulta(from, to));
  }

  // categories se auto-referencia vía parent_id; PostgREST no resuelve un
  // embed de "categories" dentro de sí misma en este anidamiento, así que
  // el nombre del padre se resuelve acá con un mapa simple en vez de un
  // segundo nivel de embed.
  const parentIds = Array.from(
    new Set(
      data
        .map((p) => p.catalog_products?.categories?.parent_id)
        .filter((id): id is string => !!id)
    )
  );

  let parentNameById = new Map<string, string>();
  if (parentIds.length > 0) {
    const { data: parents } = await supabase.from('categories').select('id, name').in('id', parentIds);
    parentNameById = new Map((parents || []).map((c) => [c.id, c.name]));
  }

  return data.map((product) => toManagementItem(product, parentNameById, withOrderCount));
}

/**
 * Una fila de gestión lista para la pantalla: la URL de la imagen, el nombre de
 * la categoría padre y, si se pidió, el conteo de pedidos en lugar del embebido.
 */
export function toManagementItem(product: any, parentNameById: Map<string, string>, withOrderCount: boolean) {
  const imageSignedUrl = product.catalog_products?.image_url
    ? getSupabaseImageUrl('products', product.catalog_products.image_url, PRESET_PRODUCT_CARD)
    : null;
  const category = product.catalog_products?.categories;
  const categoryWithParent = category
    ? { ...category, parent: category.parent_id ? { name: parentNameById.get(category.parent_id) || '' } : null }
    : category;
  const { order_items, ...rest } = product;
  return {
    ...rest,
    imageSignedUrl,
    ...(withOrderCount ? { order_count: embeddedCount(order_items) } : {}),
    catalog_products: product.catalog_products
      ? { ...product.catalog_products, categories: categoryWithParent }
      : product.catalog_products,
  };
}
