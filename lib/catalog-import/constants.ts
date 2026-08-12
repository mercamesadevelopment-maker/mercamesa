/**
 * Encabezados de la plantilla del catálogo maestro. Las claves son las que usa
 * el código; los valores, el texto que ve el admin en Excel.
 */
export const CATALOG_HEADERS = {
  name: 'Nombre del producto',
  category: 'Categoría',
  unit: 'Unidad de medida',
  description: 'Descripción',
  daneCode: 'Código DANE',
  daneUnit: 'Unidad DANE',
  ancestral: 'Alimento ancestral',
  medicinal: 'Planta medicinal',
  nonFood: 'No es alimento',
  // Vacío = producto público. Con grupo, solo lo publican sus tiendas: es el
  // caso de quien aporta el producto con sus propias fotos.
  ownerGroup: 'Exclusivo de',
} as const;

export type CatalogField = keyof typeof CATALOG_HEADERS;

export const CATALOG_COLUMN_WIDTHS: Record<CatalogField, number> = {
  name: 38,
  category: 42,
  unit: 24,
  description: 46,
  daneCode: 16,
  daneUnit: 20,
  ancestral: 20,
  medicinal: 18,
  nonFood: 18,
  ownerGroup: 28,
};

/** Columnas restringidas a una lista de valores, con desplegable en Excel. */
export const LIST_FIELDS: CatalogField[] = [
  'category',
  'unit',
  'ancestral',
  'medicinal',
  'nonFood',
  'ownerGroup',
];

/** Nombres de las listas en la hoja "Listas". */
export const LIST_NAMES = {
  categories: 'Categorías',
  units: 'Unidades de medida',
  yesNo: 'Sí / No',
  storeGroups: 'Grupos de tiendas',
} as const;

/** Filas de la plantilla que llevan desplegable y formato listo para llenar. */
export const TEMPLATE_BLANK_ROWS = 300;

/** Un archivo con más filas que esto casi seguro viene mal armado. */
export const MAX_CATALOG_ROWS = 3000;

export const CATALOG_SCHEMA = {
  headers: CATALOG_HEADERS,
  required: ['name', 'category', 'unit'] as CatalogField[],
};

export const CATALOG_TEMPLATE_FILENAME = 'plantilla-catalogo-productos.xlsx';
