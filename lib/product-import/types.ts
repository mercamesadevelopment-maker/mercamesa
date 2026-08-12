export type ImportRowStatus =
  | 'created'
  | 'skipped'
  | 'failed'
  /** Válida, pero la carga se detuvo antes de llegar a ella. */
  | 'not_processed';

export interface ImportRowResult {
  /** Número de fila tal como se ve en Excel (el encabezado es la 1). */
  row: number;
  code: string;
  /** Nombre del catálogo si se pudo resolver; si no, el que traía el archivo. */
  name: string;
  status: ImportRowStatus;
  message?: string;
}

export interface ImportSummary {
  total: number;
  created: number;
  skipped: number;
  failed: number;
  notProcessed: number;
}

export interface ImportReport {
  summary: ImportSummary;
  rows: ImportRowResult[];
  /** true cuando solo se validó, sin escribir en la base. */
  dryRun: boolean;
}

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

/** Datos que la validación necesita de la base, ya resueltos. */
export interface ImportLookups {
  /** slug normalizado -> producto del catálogo activo */
  catalogBySlug: Map<string, { id: string; name: string; defaultUnitId: string | null }>;
  /** abreviatura o nombre normalizado -> ids de unidades activas que coinciden */
  unitIdsByText: Map<string, string[]>;
  /** catalog_product_id ya publicados por la tienda */
  existingCatalogProductIds: Set<string>;
  /** Códigos ya usados por la tienda, en mayúsculas (igual que el índice único) */
  existingProductCodes: Set<string>;
  /** Productos activos del catálogo: es el tope de filas que puede traer un archivo. */
  catalogSize: number;
}
