/** Tope de productos por carga. Filas sin precio ni stock no cuentan. */
export const MAX_IMPORT_ROWS = 100;

/** 100 filas de texto no llegan ni a 100 KB; 2 MB deja margen de sobra. */
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
