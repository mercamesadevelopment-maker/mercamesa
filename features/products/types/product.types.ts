export interface MasterProduct {
  id: number;
  name: string;
  cat: string;
  emoji: string;
  image?: string;
  defaultUnit: string;
  defaultUnitId?: string;
}

export interface Product {
  id: number | string;
  plazaId: number;
  storeId: number | string;
  storeName?: string;
  emoji: string;
  image?: string;
  name: string;
  /** Código propio de la tienda (store_products.code). Vacío en los publicados antes de existir la columna. */
  code?: string;
  cat: string;
  categoryId?: string;
  unit: string;
  unitId?: string;
  isFeatured?: boolean;
  /** Producto nuevo que propuso la tienda y el admin todavía no revisa. */
  inReview?: boolean;
  retailPrice: number;
  wsPrice: number;
  ws20: number;
  ws50: number;
  wsMin: number;
  stock: number;
  minStock: number;
  masterId?: number | string;
  desc: string;
  status: 'active' | 'inactive';
  /**
   * En cuántos pedidos aparece este producto.
   *
   * Solo lo trae el panel del tendero: `order_items` es la única clave foránea
   * que impide borrarlo, así que este número es lo que decide si se puede
   * eliminar o solo desactivar. En la vitrina pública no viaja.
   */
  orderCount?: number;
}
