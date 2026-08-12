export type {
  ImportRowStatus,
  ImportRowResult,
  ImportSummary,
  ImportReport,
} from '@/lib/spreadsheet/report';

/** Fila ya validada, lista para insertarse en catalog_products. */
export interface ValidatedCatalogRow {
  row: number;
  id: string;
  name: string;
  slug: string;
  siigoId: string;
  categoryId: string;
  defaultUnitId: string;
  description: string | null;
  daneUnitCode: string | null;
  daneUnitName: string | null;
  isAncestralFood: boolean;
  isMedicinalPlant: boolean;
  isNonFood: boolean;
}

export interface CategoryOption {
  id: string;
  /** "Padre > Hijo", o solo el nombre si es categoría raíz. */
  path: string;
}

export interface UnitOption {
  id: string;
  name: string;
  abbreviation: string;
  /** "Nombre (abrev)", como se muestra en el desplegable. */
  label: string;
}

/** Datos que la validación necesita de la base, ya resueltos. */
export interface CatalogLookups {
  categories: CategoryOption[];
  units: UnitOption[];
  /** Texto normalizado (ruta, y nombre suelto si no es ambiguo) -> ids que coinciden. */
  categoryIdsByText: Map<string, string[]>;
  /** Texto normalizado (etiqueta, nombre o abreviatura) -> ids que coinciden. */
  unitIdsByText: Map<string, string[]>;
  /** Nombre normalizado -> ruta de categoría del producto que ya existe. */
  existingNames: Map<string, string>;
  /** Slugs ya usados en catalog_products. */
  existingSlugs: Set<string>;
}
