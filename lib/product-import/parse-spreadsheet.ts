import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import { normalizeText } from '@/src/components/Shared';
import {
  TEMPLATE_HEADERS,
  TEMPLATE_HEADER_ALIASES,
  type TemplateField,
} from './constants';

/** Una fila de datos del archivo, ya mapeada a los campos de la plantilla. */
export type RawRow = Partial<Record<TemplateField, string>> & {
  /** Número de fila en Excel (el encabezado es la 1). */
  __row: number;
};

export class SpreadsheetError extends Error {}

/**
 * Normaliza un encabezado para compararlo: sin tildes, en minúscula y sin
 * espacios repetidos. Así "CATEGORÍA", "categoria" y " Categoría " son iguales.
 */
function normalizeHeader(value: string): string {
  return normalizeText(value).replace(/\s+/g, ' ').trim();
}

// Los alias van primero para que el encabezado oficial gane si alguno coincide.
const FIELD_BY_HEADER = new Map<string, TemplateField>([
  ...Object.entries(TEMPLATE_HEADER_ALIASES).map(
    ([header, field]) => [normalizeHeader(header), field] as const
  ),
  ...(Object.entries(TEMPLATE_HEADERS) as [TemplateField, string][]).map(
    ([field, header]) => [normalizeHeader(header), field] as const
  ),
]);

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
 * Convierte una matriz (encabezado + filas) en filas mapeadas a los campos de
 * la plantilla. Las columnas que no reconozca se ignoran, así el seller puede
 * agregar notas propias al archivo sin romper la carga.
 */
function mapRows(matrix: string[][]): RawRow[] {
  const headerIndex = matrix.findIndex((row) =>
    row.some((cell) => FIELD_BY_HEADER.has(normalizeHeader(cell)))
  );

  if (headerIndex === -1) {
    throw new SpreadsheetError(
      `No se encontró la fila de encabezados. Usa la plantilla descargable: debe tener al menos las columnas "${TEMPLATE_HEADERS.catalogCode}", "${TEMPLATE_HEADERS.productCode}", "${TEMPLATE_HEADERS.retailPrice}" y "${TEMPLATE_HEADERS.stock}".`
    );
  }

  const fieldByColumn = new Map<number, TemplateField>();
  matrix[headerIndex].forEach((cell, index) => {
    const field = FIELD_BY_HEADER.get(normalizeHeader(cell));
    if (field && !Array.from(fieldByColumn.values()).includes(field)) {
      fieldByColumn.set(index, field);
    }
  });

  for (const required of ['catalogCode', 'productCode', 'retailPrice', 'stock'] as TemplateField[]) {
    if (!Array.from(fieldByColumn.values()).includes(required)) {
      throw new SpreadsheetError(
        `Al archivo le falta la columna "${TEMPLATE_HEADERS[required]}". Descarga la plantilla y vuelve a intentarlo.`
      );
    }
  }

  const rows: RawRow[] = [];
  for (let i = headerIndex + 1; i < matrix.length; i++) {
    const row: RawRow = { __row: i + 1 };
    fieldByColumn.forEach((field, column) => {
      row[field] = (matrix[i][column] ?? '').trim();
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

  const matrix: string[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const cells: string[] = [];
    // rowNumber es 1-based y eachRow puede saltarse filas vacías del final.
    for (let column = 1; column <= sheet.columnCount; column++) {
      cells.push(cellToString(row.getCell(column).value));
    }
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

export async function parseSpreadsheet(
  buffer: Buffer,
  fileName: string
): Promise<RawRow[]> {
  const isCsv = fileName.toLowerCase().endsWith('.csv');
  const matrix = isCsv ? parseCsv(buffer) : await parseXlsx(buffer);
  return mapRows(matrix);
}
