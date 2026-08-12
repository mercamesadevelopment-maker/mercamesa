import ExcelJS from 'exceljs';

/**
 * Formato común de las plantillas de carga masiva, para que la del vendedor y
 * la del admin se vean y se comporten igual.
 */

const HEADER_GREEN = 'FF2A4E12';
const REFERENCE_GRAY = 'FF7A7A7A';

/** Encabezado verde, congelado y con autofiltro. */
export function styleHeaderRow(sheet: ExcelJS.Worksheet, columnCount: number) {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_GREEN } };
  header.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  header.height = 28;

  // Congelar el encabezado: con cientos de filas, saber en qué columna se está
  // escribiendo es la mitad del problema.
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnCount } };
}

/** Gris para las columnas que son solo referencia y no se deben editar. */
export function styleReferenceCell(cell: ExcelJS.Cell) {
  cell.font = { color: { argb: REFERENCE_GRAY } };
}

/**
 * Hoja de instrucciones. Va aparte a propósito: cualquier texto suelto en la
 * hoja de datos rompería la lectura del encabezado al volver a subir el archivo.
 */
export function buildInstructionsSheet(
  workbook: ExcelJS.Workbook,
  title: string,
  lines: string[]
): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet('Instrucciones');
  sheet.getColumn(1).width = 100;

  const titleRow = sheet.addRow([title]);
  titleRow.font = { bold: true };
  sheet.addRow([]);

  for (const line of lines) {
    const row = sheet.addRow([line]);
    row.alignment = { wrapText: true, vertical: 'top' };
    sheet.addRow([]);
  }

  return sheet;
}

/**
 * Hoja con las listas de valores permitidos, una por columna. Devuelve la
 * referencia de rango de cada lista para usarla en `addListValidation`.
 *
 * Las listas van en una hoja aparte y no en línea porque la validación en línea
 * de Excel tiene un tope de 255 caracteres: con 165 categorías no cabe.
 */
export function buildListsSheet(
  workbook: ExcelJS.Workbook,
  lists: Record<string, string[]>,
  sheetName = 'Listas'
): Record<string, string> {
  const sheet = workbook.addWorksheet(sheetName);
  const ranges: Record<string, string> = {};

  Object.entries(lists).forEach(([name, values], index) => {
    const column = index + 1;
    const letter = sheet.getColumn(column).letter;

    sheet.getColumn(column).width = Math.min(
      60,
      Math.max(name.length, ...values.map((v) => v.length)) + 4
    );
    sheet.getCell(1, column).value = name;
    sheet.getCell(1, column).font = { bold: true };

    values.forEach((value, rowIndex) => {
      sheet.getCell(rowIndex + 2, column).value = value;
    });

    // Referencia absoluta: si es relativa, Excel la desplaza fila a fila y la
    // validación deja de apuntar a la lista completa.
    ranges[name] = `'${sheetName}'!$${letter}$2:$${letter}$${values.length + 1}`;
  });

  // La hoja se deja visible: si el usuario necesita copiar un valor exacto,
  // ocultarla solo le estorba. Es referencia, no un detalle a esconder.
  return ranges;
}

/**
 * Restringe una columna a los valores de una lista, con desplegable.
 *
 * Ojo: esto es ayuda, no seguridad. Excel deja pegar valores que se saltan la
 * validación, así que quien recibe el archivo debe validar igual del lado del
 * servidor.
 */
export function addListValidation(
  sheet: ExcelJS.Worksheet,
  column: number,
  rangeFormula: string,
  options: { rows: number; allowBlank?: boolean; message?: string }
) {
  const letter = sheet.getColumn(column).letter;

  // `worksheet.dataValidations.add(rango, ...)` existe en exceljs pero no está
  // en sus tipos. Se usa igual porque aplicar la validación a un rango de una
  // sola vez es lo correcto: hacerlo celda por celda obligaría a materializar
  // miles de celdas vacías solo para llevar la validación.
  const validations = (sheet as unknown as {
    dataValidations: { add: (address: string, validation: unknown) => unknown };
  }).dataValidations;

  validations.add(`${letter}2:${letter}${options.rows + 1}`, {
    type: 'list',
    allowBlank: options.allowBlank ?? true,
    formulae: [rangeFormula],
    showErrorMessage: true,
    errorStyle: 'stop',
    errorTitle: 'Valor no permitido',
    error: options.message ?? 'Elige un valor de la lista desplegable.',
  });
}
