/**
 * El tope de filas por carga no es un número fijo: es la cantidad de productos
 * activos del catálogo (`ImportLookups.catalogSize`). Un archivo con más filas
 * que el catálogo entero solo puede venir de un error.
 */

/**
 * Filas por INSERT. El trabajo se hace en una sola petición, escribiendo por
 * bloques: con 3.000 filas son 15 idas y vueltas en vez de 30 con bloques de
 * 100, y el bloque sigue siendo lo bastante chico para acotar el reintento fila
 * por fila cuando algo falla.
 */
export const INSERT_CHUNK_SIZE = 200;

/**
 * Tope de reintentos individuales acumulados en una carga. El reintento fila por
 * fila existe para aislar cuál falló, pero es secuencial: sin este tope, una
 * carga de 3.000 filas con muchos conflictos se volvería miles de consultas
 * seguidas y se pasaría de cualquier timeout. Al llegar acá se corta y lo que
 * queda se reporta como no procesado.
 */
export const MAX_ROW_BY_ROW_RETRIES = 300;

/**
 * Un archivo de 3.000 filas ronda los 300 KB, así que 2 MB deja margen de sobra
 * y el guard sigue sirviendo contra subidas absurdas.
 */
export const MAX_FILE_BYTES = 2 * 1024 * 1024;

export const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx'] as const;

export const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Encabezados de la plantilla. Las claves son las que usa el resto del código;
 * los valores, el texto exacto que ve el seller en Excel.
 *
 * El parser compara encabezados normalizados (sin tildes, en minúscula), así
 * que "categoria" o "CATEGORÍA" también funcionan.
 */
export const TEMPLATE_HEADERS = {
  catalogCode: 'Código catálogo',
  name: 'Producto',
  category: 'Categoría',
  subcategory: 'Subcategoría',
  unit: 'Unidad',
  productCode: 'Código del producto',
  retailPrice: 'Precio minorista',
  stock: 'Stock',
  wholesalePrice: 'Precio mayorista',
  wholesaleMinQty: 'Cantidad mínima mayorista',
  minOrderQty: 'Pedido mínimo',
} as const;

export type TemplateField = keyof typeof TEMPLATE_HEADERS;

/**
 * Encabezados alternativos aceptados al leer un archivo. La columna del catálogo
 * se llamaba solo "Código" antes de que existiera el código del producto; se
 * sigue aceptando para no romper plantillas ya descargadas.
 */
export const TEMPLATE_HEADER_ALIASES: Record<string, TemplateField> = {
  'Código': 'catalogCode',
  'Código de barras': 'productCode',
  'Tu código': 'productCode',
};

/** Esquema con el que se lee un archivo subido por el vendedor. */
export const TEMPLATE_SCHEMA = {
  headers: TEMPLATE_HEADERS,
  aliases: TEMPLATE_HEADER_ALIASES,
  required: ['catalogCode', 'productCode', 'retailPrice', 'stock'] as TemplateField[],
};

/** Anchos de columna del xlsx, en el mismo orden que TEMPLATE_HEADERS. */
export const TEMPLATE_COLUMN_WIDTHS: Record<TemplateField, number> = {
  catalogCode: 28,
  name: 38,
  category: 22,
  subcategory: 22,
  unit: 12,
  productCode: 22,
  retailPrice: 18,
  stock: 12,
  wholesalePrice: 18,
  wholesaleMinQty: 24,
  minOrderQty: 16,
};

/** La primera fila de datos en Excel es la 2: la 1 es el encabezado. */
export const HEADER_ROW_OFFSET = 2;
