import ExcelJS from 'exceljs';
import {
  addListValidation,
  buildInstructionsSheet,
  buildListsSheet,
  styleEditableColumn,
  styleHeaderRow,
  styleReferenceCell,
} from '@/lib/spreadsheet/workbook';
import { SpreadsheetError } from '@/lib/spreadsheet/parse';
import { IMPORT_FIELDS, ivaText, mapHeaders, SHEET_HEADERS, type CellValue, type SheetColumn, type SheetRow } from './price-import';
import type { UnitOption } from './price-grid';

/**
 * El Excel de «Mis productos»: el tendero lo baja, cambia precios, stock y lo
 * demás que le toca, y lo vuelve a subir. Qué cambió lo decide
 * `planPriceImport` (`price-import.ts`).
 *
 * Corre en el navegador, con `exceljs` cargado solo al usarlo (ver
 * `app/seller/products/services/price-workbook.service.ts`).
 */

export const PRICE_SHEET_NAME = 'Productos';
export const PRICE_WORKBOOK_MAX_BYTES = 5 * 1024 * 1024;

export interface PriceSheetProduct {
  id: string;
  code: string;
  name: string;
  storeName?: string;
  categoryLabel?: string;
  /** Abreviatura de la unidad. */
  unit: string;
  price: number;
  wsPrice: number | null;
  wsMin: number | null;
  stock: number;
  ivaRate: number;
  isActive: boolean;
}

const ANCHOS: Record<SheetColumn, number> = {
  id: 10,
  code: 14,
  name: 40,
  store: 24,
  category: 32,
  unit: 10,
  price: 16,
  wsPrice: 16,
  wsMin: 14,
  stock: 12,
  iva: 8,
  isActive: 12,
};

const UNIDADES = 'Unidades de medida';
const SI_NO = 'Publicado';

export async function buildPriceWorkbook(input: {
  title: string;
  products: PriceSheetProduct[];
  units: UnitOption[];
  /** Columna «Tienda»: para quien maneja varias. */
  withStore: boolean;
}): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();

  const columnas: SheetColumn[] = [
    'id',
    'code',
    'name',
    ...(input.withStore ? (['store'] as const) : []),
    'category',
    'unit',
    'price',
    'wsPrice',
    'wsMin',
    'stock',
    'iva',
    'isActive',
  ];
  const col = (c: SheetColumn) => columnas.indexOf(c) + 1;
  const editables = new Set<number>(IMPORT_FIELDS.map((f) => col(f)));

  const sheet = workbook.addWorksheet(PRICE_SHEET_NAME);
  sheet.columns = columnas.map((c) => ({ header: SHEET_HEADERS[c], key: c, width: ANCHOS[c] }));
  styleHeaderRow(sheet, columnas.length);
  // La llave para encontrar el producto al volver a subir el archivo. Oculta:
  // al tendero no le dice nada, y si la borra se usa el código.
  sheet.getColumn(col('id')).hidden = true;

  for (const p of input.products) {
    const row = sheet.addRow({
      id: p.id,
      code: p.code,
      name: p.name,
      store: p.storeName ?? '',
      category: p.categoryLabel ?? '',
      unit: p.unit,
      price: p.price,
      wsPrice: p.wsPrice ?? '',
      wsMin: p.wsMin ?? '',
      stock: p.stock,
      iva: ivaText(p.ivaRate),
      isActive: p.isActive ? 'Sí' : 'No',
    });
    columnas.forEach((_, i) => {
      if (!editables.has(i + 1)) styleReferenceCell(row.getCell(i + 1));
    });
    row.getCell(col('price')).numFmt = '#,##0';
    row.getCell(col('wsPrice')).numFmt = '#,##0';
    // Como texto: un código numérico largo no pasa a notación científica.
    row.getCell(col('code')).numFmt = '@';
  }
  for (const c of editables) styleEditableColumn(sheet, c, input.products.length);

  buildInstructionsSheet(workbook, input.title, [
    `1. En la hoja "${PRICE_SHEET_NAME}" están todos tus productos. Cambia solo las columnas en verde claro: ${IMPORT_FIELDS.map((f) => `"${SHEET_HEADERS[f]}"`).join(', ')}.`,
    `2. "${SHEET_HEADERS.name}", "${SHEET_HEADERS.category}" e "${SHEET_HEADERS.iva}" (en gris) son del catálogo de MercaMesa: si las cambias aquí no se aplican.`,
    `3. Decimales con coma o con punto: 2,5 o 2.5. Los precios van sin decimales. "${SHEET_HEADERS.wsPrice}" y "${SHEET_HEADERS.wsMin}" se pueden dejar vacíos.`,
    `4. "${SHEET_HEADERS.unit}" y "${SHEET_HEADERS.isActive}" se eligen de la lista. Un producto publicado necesita precio.`,
    '5. No borres ni agregues filas: para agregar productos usa "Carga masiva". Las filas que no reconozcamos se ignoran.',
    '6. Guarda el archivo como Excel (.xlsx) y súbelo desde Productos → Importar Excel. Los cambios aparecen resaltados en la tabla: revísalos y dale "Guardar". Hasta entonces no cambia nada en tu tienda.',
  ]);

  const abreviaturas = Array.from(new Set(input.units.map((u) => u.abbreviation).filter(Boolean)));
  const listas: Record<string, string[]> = { [SI_NO]: ['Sí', 'No'] };
  if (abreviaturas.length > 0) listas[UNIDADES] = abreviaturas;
  const rangos = buildListsSheet(workbook, listas);

  const filas = Math.max(input.products.length, 1);
  addListValidation(sheet, col('isActive'), rangos[SI_NO], { rows: filas, message: 'Elige Sí o No.' });
  if (rangos[UNIDADES]) {
    addListValidation(sheet, col('unit'), rangos[UNIDADES], {
      rows: filas,
      message: 'Elige una unidad de la lista. Están todas en la hoja "Listas".',
    });
  }

  return workbook.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}

/** Fórmula, texto enriquecido o hipervínculo: lo que se ve en la celda. */
function valorDeCelda(value: ExcelJS.CellValue): CellValue {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.trim();
  if (value instanceof Date) return '';
  const obj = value as unknown as Record<string, unknown>;
  if (Array.isArray(obj.richText)) return obj.richText.map((p: any) => p.text ?? '').join('').trim();
  if ('result' in obj) {
    const r = obj.result;
    return typeof r === 'number' || typeof r === 'boolean' ? r : String(r ?? '').trim();
  }
  if ('text' in obj) return String(obj.text ?? '').trim();
  return '';
}

/**
 * Lee la hoja «Productos» (o la primera, si le cambiaron el nombre). Las
 * columnas se reconocen por su encabezado, en cualquier orden.
 */
export async function readPriceWorkbook(buffer: ArrayBuffer): Promise<SheetRow[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw new SpreadsheetError('No se pudo leer el archivo. Verifica que sea un Excel (.xlsx) y no esté dañado.');
  }
  const sheet =
    workbook.worksheets.find((s) => s.name.trim().toLowerCase() === PRICE_SHEET_NAME.toLowerCase()) ??
    workbook.worksheets[0];
  if (!sheet) throw new SpreadsheetError('El archivo no tiene ninguna hoja.');

  const encabezados: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, n) => {
    encabezados[n - 1] = String(valorDeCelda(cell.value));
  });
  const columnas = mapHeaders(encabezados);
  const tiene = new Set(columnas.values());
  if (!tiene.has('id') && !tiene.has('code')) {
    throw new SpreadsheetError(
      `No se encontró la columna "${SHEET_HEADERS.code}". Usa el archivo que se descarga con "Exportar Excel".`
    );
  }
  if (!IMPORT_FIELDS.some((f) => tiene.has(f))) {
    throw new SpreadsheetError('El archivo no tiene ninguna columna para cambiar (precio, stock, publicado…).');
  }

  const filas: SheetRow[] = [];
  sheet.eachRow((row, n) => {
    if (n === 1) return;
    const cells: SheetRow['cells'] = {};
    columnas.forEach((columna, i) => {
      cells[columna] = valorDeCelda(row.getCell(i + 1).value);
    });
    filas.push({ row: n, cells });
  });
  return filas;
}
