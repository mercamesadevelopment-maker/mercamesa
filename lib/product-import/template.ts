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
  TEMPLATE_COLUMN_WIDTHS,
  TEMPLATE_HEADERS,
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

export async function buildTemplateWorkbook(input: TemplateInput): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Productos');
  sheet.columns = FIELDS.map((field) => ({
    header: TEMPLATE_HEADERS[field],
    key: field,
    width: TEMPLATE_COLUMN_WIDTHS[field],
  }));

  styleHeaderRow(sheet, FIELDS.length);

  // El código del catálogo identifica el producto al volver a subir el archivo,
  // pero al tendero no le dice nada: va oculto, no borrado.
  sheet.getColumn(columnOf('catalogCode')).hidden = true;

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

  // Orden de las hojas: Productos (la primera, que es la que se lee al subir el
  // archivo), Instrucciones y Listas.
  buildInstructionsSheet(
    workbook,
    `Carga masiva de productos — ${input.storeName}`,
    [
      '1. En la hoja "Productos" están los productos del catálogo que puedes vender y aún no publicas.',
      `2. Llena las columnas en verde claro SOLO en los productos que vendes: "${TEMPLATE_HEADERS.productCode}", "${TEMPLATE_HEADERS.retailPrice}" y "${TEMPLATE_HEADERS.stock}" son obligatorias. Las filas que dejes vacías se ignoran: no hace falta borrarlas.`,
      `3. "${TEMPLATE_HEADERS.productCode}" es el código con el que reconoces el producto en tu tienda, como el de su etiqueta. No puede repetirse entre tus productos y admite máximo ${PRODUCT_CODE_MAX_LENGTH} caracteres.`,
      `4. "${TEMPLATE_HEADERS.wholesalePrice}", "${TEMPLATE_HEADERS.wholesaleMinQty}" y "${TEMPLATE_HEADERS.minOrderQty}" son opcionales. El mayorista no puede superar al minorista.`,
      `5. "${TEMPLATE_HEADERS.unit}" ya viene sugerida; cámbiala solo si vendes en otra, eligiéndola de la lista.`,
      '6. Las columnas en gris son del catálogo y no se cambian.',
      `7. Están los productos del catálogo público y los de tu grupo de tiendas, si tienes uno; los que ya publicaste no se repiten. Puedes llenar todas las filas que necesites, hasta las ${input.products.length} de esta plantilla, y subirla de una sola vez.`,
      '8. Guarda el archivo como Excel (.xlsx) o CSV y súbelo desde Productos → Carga masiva.',
    ]
  );

  // La unidad se elige de la lista. Se ofrece la abreviatura, que es lo que la
  // plantilla trae sugerido; el servidor acepta también el nombre.
  const unitOptions = Array.from(new Set(input.units.map((unit) => unit.abbreviation).filter(Boolean)));
  const ranges = buildListsSheet(workbook, { [UNITS_LIST]: unitOptions });
  if (input.products.length > 0 && unitOptions.length > 0) {
    addListValidation(sheet, columnOf('unit'), ranges[UNITS_LIST], {
      rows: input.products.length,
      allowBlank: false,
      message: 'Elige una unidad de la lista. Están todas en la hoja "Listas".',
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
