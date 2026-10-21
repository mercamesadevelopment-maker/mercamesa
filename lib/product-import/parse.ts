import { mapRows, parseSpreadsheet, readSheets, type RawRow } from '@/lib/spreadsheet/parse';
import {
  NEW_PRODUCT_SCHEMA,
  SHEET_NAMES,
  TEMPLATE_SCHEMA,
  type NewProductField,
  type TemplateField,
} from './constants';

/** Una fila del archivo que sube el vendedor. */
export type SellerRow = RawRow<TemplateField>;

/** Una fila de la hoja «Productos nuevos». */
export type NewProductRow = RawRow<NewProductField>;

/** Lee solo la hoja de productos del catálogo. */
export function parseSellerSpreadsheet(buffer: Buffer, fileName: string): Promise<SellerRow[]> {
  return parseSpreadsheet(buffer, fileName, TEMPLATE_SCHEMA);
}

/**
 * Lee las dos hojas de la plantilla.
 *
 * - «Productos» se busca por nombre. Si no está, se usa la primera hoja: así
 *   sirven un CSV y las plantillas anteriores, que tenían una sola.
 * - «Productos nuevos» es opcional: sin ella no hay productos nuevos. Un CSV no
 *   la puede traer.
 */
export async function parseSellerWorkbook(
  buffer: Buffer,
  fileName: string
): Promise<{ catalog: SellerRow[]; newProducts: NewProductRow[] }> {
  const sheets = await readSheets(buffer, fileName);
  const newMatrix = sheets.byName(SHEET_NAMES.newProducts);

  let catalogMatrix = sheets.byName(SHEET_NAMES.catalog);
  if (!catalogMatrix && sheets.first.matrix !== newMatrix) catalogMatrix = sheets.first.matrix;

  return {
    catalog: catalogMatrix ? mapRows(catalogMatrix, TEMPLATE_SCHEMA) : [],
    newProducts: newMatrix ? mapRows(newMatrix, NEW_PRODUCT_SCHEMA) : [],
  };
}
