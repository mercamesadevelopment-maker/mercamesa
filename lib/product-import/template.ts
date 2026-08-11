import ExcelJS from 'exceljs';
import { PRODUCT_CODE_MAX_LENGTH } from '@/lib/products/product-code';
import {
  MAX_IMPORT_ROWS,
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

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2A4E12' } };
  header.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  header.height = 28;

  // Congelar el encabezado: con cientos de filas, saber en qué columna se está
  // escribiendo es la mitad del problema.
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

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
      const cell = row.getCell(index + 1);
      if (!editableColumns.has(index + 1)) {
        cell.font = { color: { argb: 'FF7A7A7A' } };
      }
    });

    row.getCell(FIELDS.indexOf('retailPrice') + 1).numFmt = '#,##0';
    row.getCell(FIELDS.indexOf('wholesalePrice') + 1).numFmt = '#,##0';
    // Como texto: si no, Excel convierte un código largo como 7702004003508 a
    // notación científica y se come los ceros a la izquierda.
    row.getCell(FIELDS.indexOf('productCode') + 1).numFmt = '@';
  }

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: FIELDS.length },
  };

  buildInstructionsSheet(workbook, input);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function buildInstructionsSheet(workbook: ExcelJS.Workbook, input: TemplateInput) {
  // Va en hoja aparte a propósito: cualquier texto suelto en la hoja de datos
  // rompería la lectura del encabezado al volver a subir el archivo.
  const sheet = workbook.addWorksheet('Instrucciones');
  sheet.getColumn(1).width = 100;

  const lines: { text: string; bold?: boolean; spaceAfter?: boolean }[] = [
    { text: `Carga masiva de productos — ${input.storeName}`, bold: true, spaceAfter: true },
    { text: '1. En la hoja "Productos" está todo el catálogo que aún no publicas.', spaceAfter: false },
    {
      text: `2. Llena "${TEMPLATE_HEADERS.productCode}", "${TEMPLATE_HEADERS.retailPrice}" y "${TEMPLATE_HEADERS.stock}" SOLO en los productos que vendes. Las filas que dejes vacías se ignoran: no hace falta borrarlas.`,
    },
    {
      text: `3. Ojo con las dos columnas de código: "${TEMPLATE_HEADERS.catalogCode}" ya viene llena y NO se debe modificar (es la que identifica el producto), mientras que "${TEMPLATE_HEADERS.productCode}" la escribes tú: es el código con el que reconoces el producto en tu tienda, como el de su etiqueta. No puede repetirse entre tus productos y admite máximo ${PRODUCT_CODE_MAX_LENGTH} caracteres.`,
    },
    {
      text: `4. Puedes subir hasta ${MAX_IMPORT_ROWS} productos por archivo. Si vendes más, divídelo en varios.`,
    },
    {
      text: `5. "${TEMPLATE_HEADERS.wholesalePrice}", "${TEMPLATE_HEADERS.wholesaleMinQty}" y "${TEMPLATE_HEADERS.minOrderQty}" son opcionales. El mayorista no puede superar al minorista.`,
    },
    {
      text: `6. "${TEMPLATE_HEADERS.unit}" ya viene sugerida; cámbiala solo si vendes en otra. Debe ser una de la lista de abajo.`,
    },
    {
      text: '7. Guarda el archivo como Excel (.xlsx) o CSV y súbelo desde Productos → Carga masiva.',
      spaceAfter: true,
    },
    { text: 'Unidades de medida válidas', bold: true },
  ];

  for (const line of lines) {
    const row = sheet.addRow([line.text]);
    if (line.bold) row.font = { bold: true };
    row.alignment = { wrapText: true, vertical: 'top' };
    if (line.spaceAfter !== false) sheet.addRow([]);
  }

  for (const unit of input.units) {
    sheet.addRow([`   • ${unit.abbreviation} — ${unit.name}`]);
  }
}
