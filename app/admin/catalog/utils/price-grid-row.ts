import type { PriceGridRow } from '@/features/store-products/types';
import { getSupabaseImageUrl, PRESET_THUMBNAIL } from '@/lib/supabase/supabase-image';
import type { StoreProduct } from '../hooks/useStoreProducts';

/** Un producto de una tienda como fila de la tabla de precios del admin. */
export function toPriceGridRow(p: StoreProduct): PriceGridRow {
  const cp = p.catalog_products;
  return {
    id: p.id,
    catalogProductId: p.catalog_product_id,
    code: p.code ?? '',
    name: cp?.name ?? 'Desconocido',
    image: cp?.image_url ? getSupabaseImageUrl('products', cp.image_url, PRESET_THUMBNAIL) : null,
    cat: cp?.categories?.name ?? 'Sin categoría',
    storeName: p.stores?.name ?? '',
    description: cp?.description ?? '',
    ivaRate: Number(cp?.iva_rate ?? 0),
    inReview: cp?.review_status === 'pending',
    values: {
      categoryId: cp?.category_id ?? null,
      unitId: p.unit_id ?? null,
      price: Number(p.price_per_unit),
      wsPrice: p.wholesale_price == null ? null : Number(p.wholesale_price),
      wsMin: p.wholesale_min_qty == null ? null : Number(p.wholesale_min_qty),
      stock: Number(p.stock ?? 0),
      isActive: Boolean(p.is_active),
    },
  };
}
