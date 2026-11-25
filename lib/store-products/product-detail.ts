import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseImageUrl, PRESET_LOGO } from '@/lib/supabase/supabase-image';
import { listStorefront, type toStorefrontItem } from './storefront';

type StorefrontItem = ReturnType<typeof toStorefrontItem>;

/** Lo que la página del producto muestra además de lo que ya trae la tarjeta. */
export interface ProductDetail extends StorefrontItem {
  description: string | null;
  /** «Frutas › Cítricos», o solo la que haya. */
  categoryPath: string | null;
  /** La foto original, para el zoom: el derivado `card` es de 480 px y se ve borroso de cerca. */
  imageOriginalUrl: string | null;
  store: { id: string; name: string; slug: string; marketplace: string | null; logoUrl: string | null };
}

/**
 * Arma la ficha con lo que da la vitrina, el catálogo y la tienda. Es pura: el
 * servidor la llama con las tres filas.
 */
export function toProductDetail(
  item: StorefrontItem,
  catalog: { description: string | null } | null,
  store: { logo_url: string | null } | null
): ProductDetail {
  const parent = item.catalog_products.parent_category_name;
  const child = item.catalog_products.categories?.name ?? null;
  const categoryPath = parent && child && parent !== child ? `${parent} › ${child}` : child ?? parent ?? null;
  const imagePath = item.catalog_products.image_url;
  const description = catalog?.description?.trim() || null;

  return {
    ...item,
    description,
    categoryPath,
    imageOriginalUrl: imagePath ? getSupabaseImageUrl('products', imagePath) : null,
    store: {
      id: item.store_id,
      name: item.stores.name ?? 'Tienda',
      slug: item.stores.slug ?? '',
      marketplace: item.stores.marketplaces?.name ?? null,
      logoUrl: store?.logo_url ? getSupabaseImageUrl('stores', store.logo_url, PRESET_LOGO) : null,
    },
  };
}

/**
 * La ficha de un producto de la vitrina, o `null` si no se puede ver.
 *
 * Pasa por `listStorefront`, la misma consulta de la tarjeta: trae el precio con
 * la oferta vigente y respeta lo que la vitrina oculta (sin publicar, sin precio,
 * exclusivo de otro grupo). Lo que la vista no trae —la descripción y el logo— se
 * lee aparte; `catalog_products` y `stores` se pueden leer sin sesión.
 */
export async function loadProductDetail(supabase: SupabaseClient<any>, id: string): Promise<ProductDetail | null> {
  const { data } = await listStorefront(supabase, new URLSearchParams({ product_id: id }), null);
  const item = data[0];
  if (!item) return null;

  const [catalog, store] = await Promise.all([
    item.catalog_product_id
      ? supabase.from('catalog_products').select('description').eq('id', item.catalog_product_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('stores').select('logo_url').eq('id', item.store_id).maybeSingle(),
  ]);

  return toProductDetail(item, catalog.data, store.data);
}
