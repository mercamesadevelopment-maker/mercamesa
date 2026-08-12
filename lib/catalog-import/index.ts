import { parseSpreadsheet, type RawRow } from '@/lib/spreadsheet/parse';
import { CATALOG_SCHEMA, type CatalogField } from './constants';

export * from './constants';
export * from './types';
export { slugify, uniqueSlug } from './slug';
export { loadCatalogLookups, normalizeLookupKey } from './lookups';
export { validateCatalogRows, type CatalogRow, type CatalogValidationResult } from './validate-rows';
export { buildCatalogTemplate, type CatalogTemplateInput } from './template';
export { SpreadsheetError } from '@/lib/spreadsheet/parse';
export { buildReport } from '@/lib/spreadsheet/report';

/** Lee el archivo del admin con el esquema de la plantilla del catálogo. */
export function parseCatalogSpreadsheet(
  buffer: Buffer,
  fileName: string
): Promise<RawRow<CatalogField>[]> {
  return parseSpreadsheet(buffer, fileName, CATALOG_SCHEMA);
}
