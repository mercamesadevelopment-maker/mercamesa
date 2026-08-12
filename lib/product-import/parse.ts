import { parseSpreadsheet, type RawRow } from '@/lib/spreadsheet/parse';
import { TEMPLATE_SCHEMA, type TemplateField } from './constants';

/** Una fila del archivo que sube el vendedor. */
export type SellerRow = RawRow<TemplateField>;

/** Lee el archivo del vendedor con el esquema de su plantilla. */
export function parseSellerSpreadsheet(buffer: Buffer, fileName: string): Promise<SellerRow[]> {
  return parseSpreadsheet(buffer, fileName, TEMPLATE_SCHEMA);
}
