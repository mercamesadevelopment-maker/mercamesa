import { normalizeText } from '@/src/components/Shared';
import { generateSiigoCode } from '@/lib/siigo';
import { isBlank } from '@/lib/spreadsheet/parse';
import type { ImportRowResult } from '@/lib/spreadsheet/report';
import { uniqueSlug } from '@/lib/catalog-import/slug';
import { NEW_PRODUCT_HEADERS, SHEET_NAMES } from './constants';
import type { NewProductRow } from './parse';
import { validateSaleFields } from './sale-fields';
import type { ImportLookups, ValidatedNewRow } from './types';

/** Una fila sin nada escrito es de las vacías que trae la plantilla. */
function isIgnorableRow(row: NewProductRow): boolean {
  return (Object.keys(NEW_PRODUCT_HEADERS) as (keyof typeof NEW_PRODUCT_HEADERS)[]).every((field) =>
    isBlank(row[field])
  );
}

const nameKey = (value: string) => normalizeText(value).replace(/\s+/g, ' ').trim();

export interface NewRowsValidation {
  valid: ValidatedNewRow[];
  results: ImportRowResult[];
}

/**
 * Valida la hoja «Productos nuevos». Cada fila válida crea un producto del
 * catálogo, en revisión, y lo publica en la tienda.
 *
 * `seenProductCodes` viene de la hoja «Productos»: un código no puede repetirse
 * entre las dos.
 */
export function validateNewRows(
  rows: NewProductRow[],
  lookups: ImportLookups,
  seenProductCodes: Map<string, string>
): NewRowsValidation {
  const valid: ValidatedNewRow[] = [];
  const results: ImportRowResult[] = [];
  const seenNames = new Map<string, number>();
  const takenSlugs = new Set(lookups.existingSlugs);

  for (const row of rows.filter((r) => !isIgnorableRow(r))) {
    const name = (row.name ?? '').trim().replace(/\s+/g, ' ');
    const fail = (message: string) =>
      results.push({ row: row.__row, sheet: 'new', code: '', name, status: 'failed', message });

    if (!name) {
      fail(`Falta el nombre del producto, en la columna "${NEW_PRODUCT_HEADERS.name}".`);
      continue;
    }

    const key = nameKey(name);
    const existing = lookups.visibleNames.get(key);
    if (existing !== undefined) {
      fail(
        `"${existing}" ya está en el catálogo: búscalo en la hoja "${SHEET_NAMES.catalog}" y llénalo ahí.`
      );
      continue;
    }

    const previousRow = seenNames.get(key);
    if (previousRow !== undefined) {
      fail(`Este producto ya venía en la fila ${previousRow} de esta hoja.`);
      continue;
    }
    seenNames.set(key, row.__row);

    if (isBlank(row.category)) {
      fail(`Falta la "${NEW_PRODUCT_HEADERS.category}". Elígela de la lista desplegable.`);
      continue;
    }
    const categories = lookups.categoryIdsByText.get(nameKey(row.category!)) ?? [];
    if (categories.length === 0) {
      fail(
        `La categoría "${row.category}" no existe. Elígela de la lista desplegable (están todas en la hoja "Listas").`
      );
      continue;
    }
    if (categories.length > 1) {
      fail(
        `"${row.category}" existe bajo varias categorías. Elígela completa, como "Padre > ${row.category}", de la lista desplegable.`
      );
      continue;
    }

    const sale = validateSaleFields(row, {
      lookups,
      seenProductCodes,
      where: `la fila ${row.__row} de "${SHEET_NAMES.newProducts}"`,
      // En un producto nuevo no hay unidad sugerida: hay que elegirla.
      defaultUnitId: null,
    });
    if ('message' in sale) {
      fail(sale.message);
      continue;
    }

    const catalogProductId = crypto.randomUUID();
    valid.push({
      row: row.__row,
      name,
      catalogProductId,
      slug: uniqueSlug(name, takenSlugs),
      siigoId: generateSiigoCode(catalogProductId),
      categoryId: categories[0],
      description: isBlank(row.description) ? null : row.description!.trim(),
      ...sale.fields,
    });
  }

  return { valid, results };
}
