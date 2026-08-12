import ExcelJS from 'exceljs';
import { PRODUCT_CODE_MAX_LENGTH } from '@/lib/products/product-code';
import {
  buildInstructionsSheet,
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

/** Columnas que el seller llena; las demás son referencia del catálogo. */
const EDITABLE_FIELDS: TemplateField[] = [
  'unit',
  'productCode',
  'retailPrice',
  'stock',
  'wholesalePrice',
  'wholesaleMinQty',
  'minOrderQty',
];

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

  const editableColumns = new Set(EDITABLE_FIELDS.map((field) => FIELDS.indexOf(field) + 1));

  for (const product of input.products) {
    const row = sheet.addRow({
      catalogCode: product.code,
      name: product.name,
      category: product.category,
      subcategory: product.subcategory,
      unit: product.unit,
    });

    // Las de referencia van en gris para que se note cuáles hay que llenar.
    FIELDS.forEach((_, index) => {
      if (!editableColumns.has(index + 1)) styleReferenceCell(row.getCell(index + 1));
    });

    row.getCell(FIELDS.indexOf('retailPrice') + 1).numFmt = '#,##0';
    row.getCell(FIELDS.indexOf('wholesalePrice') + 1).numFmt = '#,##0';
    // Como texto: si no, Excel convierte un código largo como 7702004003508 a
    // notación científica y se come los ceros a la izquierda.
    row.getCell(FIELDS.indexOf('productCode') + 1).numFmt = '@';
  }

  const instructions = buildInstructionsSheet(
    workbook,
    `Carga masiva de productos — ${input.storeName}`,
    [
      '1. En la hoja "Productos" está todo el catálogo que aún no publicas.',
      `2. Llena "${TEMPLATE_HEADERS.productCode}", "${TEMPLATE_HEADERS.retailPrice}" y "${TEMPLATE_HEADERS.stock}" SOLO en los productos que vendes. Las filas que dejes vacías se ignoran: no hace falta borrarlas.`,
      `3. Ojo con las dos columnas de código: "${TEMPLATE_HEADERS.catalogCode}" ya viene llena y NO se debe modificar (es la que identifica el producto), mientras que "${TEMPLATE_HEADERS.productCode}" la escribes tú: es el código con el que reconoces el producto en tu tienda, como el de su etiqueta. No puede repetirse entre tus productos y admite máximo ${PRODUCT_CODE_MAX_LENGTH} caracteres.`,
      `4. Puedes llenar todas las filas que necesites, hasta las ${input.products.length} de esta plantilla, y subirla de una sola vez.`,
      `5. "${TEMPLATE_HEADERS.wholesalePrice}", "${TEMPLATE_HEADERS.wholesaleMinQty}" y "${TEMPLATE_HEADERS.minOrderQty}" son opcionales. El mayorista no puede superar al minorista.`,
      `6. "${TEMPLATE_HEADERS.unit}" ya viene sugerida; cámbiala solo si vendes en otra. Debe ser una de la lista de abajo.`,
      '7. Guarda el archivo como Excel (.xlsx) o CSV y súbelo desde Productos → Carga masiva.',
    ]
  );

  const unitsTitle = instructions.addRow(['Unidades de medida válidas']);
  unitsTitle.font = { bold: true };
  for (const unit of input.units) {
    instructions.addRow([`   • ${unit.abbreviation} — ${unit.name}`]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
