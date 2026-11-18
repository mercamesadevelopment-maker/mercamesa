import type { Product } from '@/features/products/types/product.types';
import type { PriceGridRow } from '@/features/store-products/types';
import { categoryLabel, type PickerCategory } from '@/lib/categories/picker';

/** Un producto del tendero como fila de la tabla de precios. Con las categorías, la de «Madre › Sub». */
export function toPriceGridRow(p: Product, categories: PickerCategory[] = []): PriceGridRow {
  return {
    id: String(p.id),
    code: p.code ?? '',
    name: p.name,
    image: p.image || null,
    emoji: p.emoji,
    cat: p.cat,
    categoryLabel: categoryLabel(categories, p.categoryId) || (p.categoryId ? p.cat : ''),
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
