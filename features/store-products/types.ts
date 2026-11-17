import type { PriceValues } from '@/lib/store-products/price-grid';

/**
 * Una fila de la tabla de precios, sea del tendero o de Inventarios
 * consolidados del admin. Cada pantalla convierte sus productos a esta forma.
 */
export interface PriceGridRow {
  /** `store_products.id`. */
  id: string;
  /** `catalog_products.id`: a dónde va un cambio de categoría. */
  catalogProductId?: string;
  code: string;
  name: string;
  image?: string | null;
  emoji?: string;
  /** Categoría, para mostrar bajo el nombre. */
  cat?: string;
  /** Solo en el admin, que ve todas las tiendas. */
  storeName?: string;
  /** Del catálogo maestro: se muestran, no se editan acá. */
  description: string;
  ivaRate: number;
  inReview?: boolean;
  values: PriceValues;
}
