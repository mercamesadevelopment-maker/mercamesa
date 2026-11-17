import type { Product } from '@/features/products/types/product.types';
import type { PriceGridRow } from '@/features/store-products/types';

/** Un producto del tendero como fila de la tabla de precios. */
export function toPriceGridRow(p: Product): PriceGridRow {
  return {
    id: String(p.id),
    code: p.code ?? '',
    name: p.name,
    image: p.image || null,
    emoji: p.emoji,
    cat: p.cat,
    description: p.desc,
    ivaRate: p.ivaRate ?? 0,
    inReview: p.inReview,
    values: {
      unitId: p.unitId || null,
      price: p.retailPrice,
      wsPrice: p.wholesalePrice ?? null,
      wsMin: p.wholesaleMinQty ?? null,
      stock: p.stock,
      isActive: p.status === 'active',
    },
  };
}
