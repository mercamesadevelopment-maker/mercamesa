import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import { normalizeText } from '@/src/components/Shared';

/**
 * Lectura de archivos .xlsx y .csv subidos por el usuario, agnóstica del
 * dominio: quien llama define qué columnas espera.
 */

/** Una fila de datos ya mapeada a los campos que pidió quien llama. */
export type RawRow<TField extends string> = Partial<Record<TField, string>> & {
  /** Número de fila tal como se ve en Excel (el encabezado es la 1). */
  __row: number;
};

/** Error de lectura que el usuario puede entender y corregir. */
export class SpreadsheetError extends Error {}

export interface SpreadsheetSchema<TField extends string> {
  /** Campo -> encabezado tal como aparece en la plantilla. */
  headers: Record<TField, string>;
  /** Encabezado alternativo -> campo. Sirve para no romper plantillas viejas. */
  aliases?: Record<string, TField>;
  /** Campos sin los cuales el archivo no sirve. */
  required: TField[];
}

/**
 * Normaliza un encabezado para compararlo: sin tildes, en minúscula y sin
 * espacios repetidos. Así "CATEGORÍA", "categoria" y " Categoría " son iguales.
 */
function normalizeHeader(value: string): string {
  return normalizeText(value).replace(/\s+/g, ' ').trim();
}

function buildHeaderMap<TField extends string>(
  schema: SpreadsheetSchema<TField>
): Map<string, TField> {
  // Los alias van primero para que el encabezado oficial gane si alguno coincide.
  return new Map<string, TField>([
    ...Object.entries(schema.aliases ?? {}).map(
      ([header, field]) => [normalizeHeader(header), field as TField] as const
    ),
    ...(Object.entries(schema.headers) as [TField, string][]).map(
      ([field, header]) => [normalizeHeader(header), field] as const
    ),
  ]);
}

/**
 * Excel en configuración regional española suele guardar el CSV en Windows-1252,
 * no en UTF-8. Se intenta UTF-8 estricto y, si el texto trae el carácter de
 * reemplazo, se reinterpreta como Windows-1252 para no perder las tildes.
 */
function decodeCsv(buffer: Buffer): string {
  const utf8 = new TextDecoder('utf-8').decode(buffer);
  if (!utf8.includes('�')) return utf8.replace(/^﻿/, '');
  return new TextDecoder('windows-1252').decode(buffer).replace(/^﻿/, '');
}

/** Las celdas de exceljs pueden ser fórmula, texto enriquecido o hipervínculo. */
function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const obj = value as unknown as Record<string, unknown>;
    if ('richText' in obj && Array.isArray(obj.richText)) {
      return obj.richText.map((part: any) => part.text ?? '').join('');
    }
    if ('text' in obj) return String(obj.text ?? '');
    if ('result' in obj) return String(obj.result ?? '');
    if ('error' in obj) return '';
    return '';
  }
  return String(value);
}

/**
 * Convierte una matriz (encabezado + filas) en filas mapeadas a los campos del
 * esquema. Las columnas que no reconozca se ignoran, así el usuario puede
 * agregar notas propias al archivo sin romper la carga.
 */
function mapRows<TField extends string>(
  matrix: string[][],
  schema: SpreadsheetSchema<TField>
): RawRow<TField>[] {
  const fieldByHeader = buildHeaderMap(schema);

  const headerIndex = matrix.findIndex((row) =>
    row.some((cell) => fieldByHeader.has(normalizeHeader(cell)))
  );

  if (headerIndex === -1) {
    const required = schema.required.map((field) => `"${schema.headers[field]}"`).join(', ');
    throw new SpreadsheetError(
      `No se encontró la fila de encabezados. Usa la plantilla descargable: debe tener al menos las columnas ${required}.`
    );
  }

  const fieldByColumn = new Map<number, TField>();
  const claimed = new Set<TField>();
  matrix[headerIndex].forEach((cell, index) => {
    const field = fieldByHeader.get(normalizeHeader(cell));
    // Si el encabezado se repite, gana la primera columna.
    if (field && !claimed.has(field)) {
      fieldByColumn.set(index, field);
      claimed.add(field);
    }
  });

  for (const field of schema.required) {
    if (!claimed.has(field)) {
      throw new SpreadsheetError(
        `Al archivo le falta la columna "${schema.headers[field]}". Descarga la plantilla y vuelve a intentarlo.`
      );
    }
  }

  const rows: RawRow<TField>[] = [];
  for (let i = headerIndex + 1; i < matrix.length; i++) {
    const row = { __row: i + 1 } as RawRow<TField>;
    fieldByColumn.forEach((field, column) => {
      row[field] = (matrix[i][column] ?? '').trim() as RawRow<TField>[TField];
    });
    rows.push(row);
  }

  return rows;
}

async function parseXlsx(buffer: Buffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new SpreadsheetError(
      'No se pudo leer el archivo. Verifica que sea un Excel (.xlsx) válido y no esté dañado.'
    );
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new SpreadsheetError('El archivo no tiene ninguna hoja con datos.');

  const columnCount = sheet.columnCount;
  const matrix: string[][] = [];

  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const cells: string[] = [];
    // `row.values` da el arreglo de la fila de una; recorrer con `getCell` hace
    // una llamada por celda y con miles de filas eso pasa de milisegundos a
    // varios segundos (medido: 4,1 s contra 0,24 s en un archivo de 3.000 filas).
    // Es un arreglo disperso con el índice 0 sin usar: las columnas son 1-based.
    const values = row.values;

    if (Array.isArray(values)) {
      for (let column = 1; column <= columnCount; column++) {
        cells.push(cellToString(values[column] as ExcelJS.CellValue));
      }
    } else {
      for (let column = 1; column <= columnCount; column++) {
        cells.push(cellToString(row.getCell(column).value));
      }
    }

    // rowNumber es 1-based y eachRow puede saltarse filas vacías del final.
    matrix[rowNumber - 1] = cells;
  });

  return Array.from(matrix, (row) => row ?? []);
}

function parseCsv(buffer: Buffer): string[][] {
  const result = Papa.parse<string[]>(decodeCsv(buffer), {
    header: false,
    skipEmptyLines: false,
  });

  // Papa reporta errores por fila (comillas sin cerrar, etc.) pero igual
  // devuelve lo que pudo leer; solo se corta si no quedó absolutamente nada.
  if (result.data.length === 0) {
    throw new SpreadsheetError('El archivo CSV está vacío o no se pudo leer.');
  }

  return result.data.map((row) => (Array.isArray(row) ? row.map(String) : []));
}

export async function parseSpreadsheet<TField extends string>(
  buffer: Buffer,
  fileName: string,
  schema: SpreadsheetSchema<TField>
): Promise<RawRow<TField>[]> {
  const isCsv = fileName.toLowerCase().endsWith('.csv');
  const matrix = isCsv ? parseCsv(buffer) : await parseXlsx(buffer);
  return mapRows(matrix, schema);
}

/** true cuando la celda vino vacía o solo con espacios. */
export function isBlank(value: string | undefined): boolean {
  return !value || value.trim() === '';
}
