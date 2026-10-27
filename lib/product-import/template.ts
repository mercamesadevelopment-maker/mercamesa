import ExcelJS from 'exceljs';
import { PRODUCT_CODE_MAX_LENGTH } from '@/lib/products/product-code';
import {
  addListValidation,
  buildInstructionsSheet,
  buildListsSheet,
  styleEditableColumn,
  styleHeaderRow,
  styleReferenceCell,
} from '@/lib/spreadsheet/workbook';
import {
  NEW_PRODUCT_BLANK_ROWS,
  NEW_PRODUCT_COLUMN_WIDTHS,
  NEW_PRODUCT_HEADERS,
  SHEET_NAMES,
  TEMPLATE_COLUMN_WIDTHS,
  TEMPLATE_HEADERS,
  type NewProductField,
  type TemplateField,
} from './constants';

export interface TemplateProduct {
  code: string;
  name: string;
  category: string;
  subcategory: string;
  unit: string;
}

export interface TemplateInput {
  storeName: string;
  products: TemplateProduct[];
  units: { name: string; abbreviation: string }[];
  /** Rutas de categoría («Padre > Hija») para el desplegable de productos nuevos. */
  categories: string[];
}

/** El orden de las columnas en la hoja. */
const FIELDS = Object.keys(TEMPLATE_HEADERS) as TemplateField[];
const columnOf = (field: TemplateField) => FIELDS.indexOf(field) + 1;

/** Columnas que el seller llena; las demás son referencia del catálogo. */
export const EDITABLE_FIELDS: TemplateField[] = [
  'unit',
  'productCode',
  'retailPrice',
  'stock',
  'wholesalePrice',
  'wholesaleMinQty',
  'minOrderQty',
];

const UNITS_LIST = 'Unidades de medida';
const CATEGORIES_LIST = 'Categorías';

const NEW_FIELDS = Object.keys(NEW_PRODUCT_HEADERS) as NewProductField[];
const newColumnOf = (field: NewProductField) => NEW_FIELDS.indexOf(field) + 1;

export async function buildTemplateWorkbook(input: TemplateInput): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(SHEET_NAMES.catalog);
  sheet.columns = FIELDS.map((field) => ({
    header: TEMPLATE_HEADERS[field],
    key: field,
    width: TEMPLATE_COLUMN_WIDTHS[field],
  }));

  styleHeaderRow(sheet, FIELDS.length);

  // El código del catálogo identifica el producto al volver a subir el archivo,
  // y es el nombre con el que se guardan las fotos para cargarlas en lote: va a
  // la vista, en gris como las demás columnas de referencia.

  const editableColumns = new Set(EDITABLE_FIELDS.map(columnOf));

  for (const product of input.products) {
    const row = sheet.addRow({
      catalogCode: product.code,
      name: product.name,
      category: product.category,
      subcategory: product.subcategory,
      unit: product.unit,
    });

    // Las de referencia van en gris; las que se llenan, en lima (abajo).
    FIELDS.forEach((_, index) => {
      if (!editableColumns.has(index + 1)) styleReferenceCell(row.getCell(index + 1));
    });

    row.getCell(columnOf('retailPrice')).numFmt = '#,##0';
    row.getCell(columnOf('wholesalePrice')).numFmt = '#,##0';
    // Como texto: si no, Excel convierte un código largo como 7702004003508 a
    // notación científica y se come los ceros a la izquierda.
    row.getCell(columnOf('productCode')).numFmt = '@';
  }

  for (const column of editableColumns) {
    styleEditableColumn(sheet, column, input.products.length);
  }

  // Productos que no están en el catálogo: todas sus columnas las llena el
  // tendero, y las que son de una lista llevan desplegable.
  const newSheet = workbook.addWorksheet(SHEET_NAMES.newProducts);
  newSheet.columns = NEW_FIELDS.map((field) => ({
    header: NEW_PRODUCT_HEADERS[field],
    key: field,
    width: NEW_PRODUCT_COLUMN_WIDTHS[field],
  }));
  styleHeaderRow(newSheet, NEW_FIELDS.length);
  for (const field of NEW_FIELDS) {
    styleEditableColumn(newSheet, newColumnOf(field), NEW_PRODUCT_BLANK_ROWS);
  }
  newSheet.getColumn(newColumnOf('productCode')).numFmt = '@';
  newSheet.getColumn(newColumnOf('retailPrice')).numFmt = '#,##0';
  newSheet.getColumn(newColumnOf('wholesalePrice')).numFmt = '#,##0';

  // Orden de las hojas: Productos (la primera, la que lee un archivo viejo o un
  // CSV), Productos nuevos, Instrucciones y Listas.
  buildInstructionsSheet(
    workbook,
    `Carga masiva de productos — ${input.storeName}`,
    [
      `1. En la hoja "${SHEET_NAMES.catalog}" están los productos del catálogo que puedes vender y aún no publicas.`,
      `2. Llena las columnas en verde claro SOLO en los productos que vendes: "${TEMPLATE_HEADERS.productCode}", "${TEMPLATE_HEADERS.retailPrice}" y "${TEMPLATE_HEADERS.stock}" son obligatorias. Las filas que dejes vacías se ignoran: no hace falta borrarlas.`,
      `3. "${TEMPLATE_HEADERS.productCode}" es el código con el que reconoces el producto en tu tienda, como el de su etiqueta. No puede repetirse entre tus productos y admite máximo ${PRODUCT_CODE_MAX_LENGTH} caracteres.`,
      `4. "${TEMPLATE_HEADERS.wholesalePrice}", "${TEMPLATE_HEADERS.wholesaleMinQty}" y "${TEMPLATE_HEADERS.minOrderQty}" son opcionales. El mayorista no puede superar al minorista.`,
      `5. "${TEMPLATE_HEADERS.unit}" ya viene sugerida; cámbiala solo si vendes en otra, eligiéndola de la lista.`,
      '6. Las columnas en gris son del catálogo y no se cambian.',
      `7. Están los productos del catálogo público y los de tu grupo de tiendas, si tienes uno; los que ya publicaste no se repiten. Puedes llenar todas las filas que necesites, hasta las ${input.products.length} de esta plantilla, y subirla de una sola vez.`,
      `8. ¿Vendes algo que no está en "${SHEET_NAMES.catalog}"? Búscalo primero ahí (Ctrl + B). Si no está, agrégalo en la hoja "${SHEET_NAMES.newProducts}": una fila por producto, con "${NEW_PRODUCT_HEADERS.category}" y "${NEW_PRODUCT_HEADERS.unit}" elegidas de la lista.`,
      '9. Los productos nuevos se publican en tu tienda de una vez, sin foto, y quedan en revisión: el equipo de MercaMesa los revisa antes de sumarlos al catálogo de todas las tiendas. La foto la puedes agregar después desde Productos.',
      '10. Guarda el archivo como Excel (.xlsx) y súbelo desde Productos → Carga masiva. Si lo guardas como CSV, solo se lee la hoja "Productos".',
      `11. Fotos: si tu tienda tiene productos propios (de tu grupo de tiendas o propuestos por ti), nombra cada foto con su "${TEMPLATE_HEADERS.catalogCode}", por ejemplo papa-criolla.jpg, y súbelas todas juntas desde Productos → Cargar imágenes.`,
    ]
  );

  // La unidad se elige de la lista. Se ofrece la abreviatura, que es lo que la
  // plantilla trae sugerido; el servidor acepta también el nombre.
  const unitOptions = Array.from(new Set(input.units.map((unit) => unit.abbreviation).filter(Boolean)));
  // Sin valores no hay lista: un rango vacío es una referencia que Excel rechaza.
  const lists: Record<string, string[]> = {};
  if (unitOptions.length > 0) lists[UNITS_LIST] = unitOptions;
  if (input.categories.length > 0) lists[CATEGORIES_LIST] = input.categories;
  const ranges = buildListsSheet(workbook, lists);

  if (ranges[UNITS_LIST]) {
    const message = 'Elige una unidad de la lista. Están todas en la hoja "Listas".';
    if (input.products.length > 0) {
      addListValidation(sheet, columnOf('unit'), ranges[UNITS_LIST], {
        rows: input.products.length,
        allowBlank: false,
        message,
      });
    }
    addListValidation(newSheet, newColumnOf('unit'), ranges[UNITS_LIST], {
      rows: NEW_PRODUCT_BLANK_ROWS,
      message,
    });
  }
  if (ranges[CATEGORIES_LIST]) {
    addListValidation(newSheet, newColumnOf('category'), ranges[CATEGORIES_LIST], {
      rows: NEW_PRODUCT_BLANK_ROWS,
      message: 'Elige una categoría de la lista. Están todas en la hoja "Listas".',
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
