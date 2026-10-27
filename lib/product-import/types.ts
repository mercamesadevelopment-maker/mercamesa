export type {
  ImportRowStatus,
  ImportRowResult,
  ImportSummary,
  ImportReport,
} from '@/lib/spreadsheet/report';

/** Fila ya validada, lista para insertarse en store_products. */
export interface ValidatedRow {
  row: number;
  /** Slug del catálogo: identifica de qué producto se trata. */
  code: string;
  name: string;
  /** Código propio de la tienda para este producto. */
  productCode: string;
  catalogProductId: string;
  unitId: string;
  pricePerUnit: number;
  stock: number;
  wholesalePrice: number | null;
  wholesaleMinQty: number | null;
  minOrderQty: number;
}

/** Producto del catálogo activo, con si esta tienda puede publicarlo. */
export interface CatalogEntry {
  id: string;
  name: string;
  defaultUnitId: string | null;
  /** `false` si el producto es exclusivo de otro grupo de tiendas. */
  usable: boolean;
}

/** Datos que la validación necesita de la base, ya resueltos. */
export interface ImportLookups {
  /** slug normalizado -> producto del catálogo activo */
  catalogBySlug: Map<string, CatalogEntry>;
  /** Nombre normalizado -> nombre, de los productos activos que esta tienda puede publicar. */
  visibleNames: Map<string, string>;
  /** Todos los slugs del catálogo, también los inactivos: el de un producto nuevo no puede repetirse. */
  existingSlugs: Set<string>;
  /** Categoría por texto: ruta «Padre > Hija», o el nombre si no se repite. */
  categoryIdsByText: Map<string, string[]>;
  /** El grupo de la tienda, o null. */
  storeGroupId: string | null;
  /** abreviatura o nombre normalizado -> ids de unidades activas que coinciden */
  unitIdsByText: Map<string, string[]>;
  /** catalog_product_id ya publicados por la tienda */
  existingCatalogProductIds: Set<string>;
  /** Códigos ya usados por la tienda, en mayúsculas (igual que el índice único) */
  existingProductCodes: Set<string>;
  /** Productos activos del catálogo: es el tope de filas que puede traer un archivo. */
  catalogSize: number;
}

/** Fila de la hoja «Productos nuevos» ya validada: crea el producto del catálogo y lo publica. */
export interface ValidatedNewRow {
  row: number;
  name: string;
  /** Id del producto del catálogo, generado acá porque el código de Siigo sale de él. */
  catalogProductId: string;
  slug: string;
  siigoId: string;
  categoryId: string;
  description: string | null;
  productCode: string;
  unitId: string;
  pricePerUnit: number;
  stock: number;
  wholesalePrice: number | null;
  wholesaleMinQty: number | null;
  minOrderQty: number;
}
