import { normalizeText } from '@/lib/utils/text';
import { SpreadsheetError, isBlank } from '@/lib/spreadsheet/parse';
import { EXCLUSIVE_PRODUCT_MESSAGE } from '@/lib/catalog/visibility';
import type { ImportRowResult } from '@/lib/spreadsheet/report';
import { TEMPLATE_HEADERS } from './constants';
import type { SellerRow } from './parse';
import type { ImportLookups, ValidatedRow } from './types';
import { validateSaleFields } from './sale-fields';

export { parseNumber } from './parse-number';

/**
 * La plantilla trae todo el catálogo, así que el seller marca lo que vende
 * llenando las columnas editables. Si no tocó ninguna, la fila no es un error:
 * es un producto que no vende.
 *
 * Basta con que haya llenado una para que la fila entre a validarse: así, si
 * escribió el código pero olvidó el precio, se lo decimos en vez de ignorarlo
 * en silencio.
 */
function isIgnorableRow(row: SellerRow): boolean {
  return isBlank(row.retailPrice) && isBlank(row.stock) && isBlank(row.productCode);
}

export interface ValidationResult {
  valid: ValidatedRow[];
  results: ImportRowResult[];
}

/**
 * `seenProductCodes` se comparte con la hoja de productos nuevos: un código no
 * puede repetirse entre las dos.
 */
export function validateRows(
  rows: SellerRow[],
  lookups: ImportLookups,
  seenProductCodes: Map<string, string> = new Map()
): ValidationResult {
  const candidates = rows.filter((row) => !isIgnorableRow(row));

  // Nadie puede publicar más productos de los que existen en el catálogo: si el
  // archivo trae más filas con datos, viene duplicado o alterado.
  if (candidates.length > lookups.catalogSize) {
    throw new SpreadsheetError(
      `El archivo trae ${candidates.length} productos con datos, más que los ${lookups.catalogSize} del catálogo. Revisa que no tenga filas repetidas y descarga la plantilla de nuevo.`
    );
  }

  const valid: ValidatedRow[] = [];
  const results: ImportRowResult[] = [];
  const seenCodes = new Map<string, number>();

  for (const row of candidates) {
    const code = (row.catalogCode ?? '').trim();
    const fileName = (row.name ?? '').trim();

    const fail = (message: string, name = fileName) =>
      results.push({ row: row.__row, code, name, status: 'failed', message });

    if (!code) {
      fail(`Falta el "${TEMPLATE_HEADERS.catalogCode}". No borres esa columna de la plantilla.`);
      continue;
    }

    const normalizedCode = normalizeText(code).trim();

    const previousRow = seenCodes.get(normalizedCode);
    if (previousRow !== undefined) {
      fail(`Este producto ya venía en la fila ${previousRow} del archivo.`);
      continue;
    }
    seenCodes.set(normalizedCode, row.__row);

    const product = lookups.catalogBySlug.get(normalizedCode);
    if (!product) {
      fail(
        `El código "${code}" no existe en el catálogo o está inactivo. Descarga la plantilla de nuevo y copia el código desde ahí.`
      );
      continue;
    }

    if (!product.usable) {
      fail(EXCLUSIVE_PRODUCT_MESSAGE, product.name);
      continue;
    }

    if (lookups.existingCatalogProductIds.has(product.id)) {
      results.push({
        row: row.__row,
        code,
        name: product.name,
        status: 'skipped',
        message: 'Ya lo tienes publicado. Edita su precio o stock desde el listado.',
      });
      continue;
    }

    const sale = validateSaleFields(row, {
      lookups,
      seenProductCodes,
      where: `la fila ${row.__row}`,
      defaultUnitId: product.defaultUnitId,
    });
    if ('message' in sale) {
      fail(sale.message, product.name);
      continue;
    }

    valid.push({
      row: row.__row,
      code,
      name: product.name,
      catalogProductId: product.id,
      ...sale.fields,
    });
  }

  return { valid, results };
}
