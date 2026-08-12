import { generateSiigoCode } from '@/lib/siigo';
import { SpreadsheetError, isBlank, type RawRow } from '@/lib/spreadsheet/parse';
import type { ImportRowResult } from '@/lib/spreadsheet/report';
import { CATALOG_HEADERS, MAX_CATALOG_ROWS, type CatalogField } from './constants';
import { normalizeLookupKey } from './lookups';
import { uniqueSlug } from './slug';
import type { CatalogLookups, ValidatedCatalogRow } from './types';

export type CatalogRow = RawRow<CatalogField>;

/** Valores aceptados para las banderas. El desplegable ofrece "Sí" y "No". */
const TRUE_VALUES = new Set(['si', 'si.', 'sí', 'x', 'true', 'verdadero', '1']);
const FALSE_VALUES = new Set(['no', 'false', 'falso', '0', '']);

export interface CatalogValidationResult {
  valid: ValidatedCatalogRow[];
  results: ImportRowResult[];
}

/** Una fila sin ningún dato es una fila de sobra de la plantilla, no un error. */
function isIgnorableRow(row: CatalogRow): boolean {
  return (
    isBlank(row.name) &&
    isBlank(row.category) &&
    isBlank(row.unit) &&
    isBlank(row.description) &&
    isBlank(row.daneCode)
  );
}

function parseFlag(value: string | undefined): boolean | null {
  const normalized = normalizeLookupKey(value ?? '');
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return null;
}

export function validateCatalogRows(
  rows: CatalogRow[],
  lookups: CatalogLookups
): CatalogValidationResult {
  const candidates = rows.filter((row) => !isIgnorableRow(row));

  if (candidates.length > MAX_CATALOG_ROWS) {
    throw new SpreadsheetError(
      `El archivo trae ${candidates.length} productos y el máximo por carga es ${MAX_CATALOG_ROWS}. Divídelo en varios archivos.`
    );
  }

  const valid: ValidatedCatalogRow[] = [];
  const results: ImportRowResult[] = [];
  const seenNames = new Map<string, number>();

  // Arranca con los slugs ya guardados para que la desambiguación tenga en
  // cuenta tanto la base como lo que se va generando en este mismo archivo.
  const takenSlugs = new Set(lookups.existingSlugs);

  for (const row of candidates) {
    const name = (row.name ?? '').trim();

    const fail = (message: string) =>
      results.push({ row: row.__row, code: '', name, status: 'failed', message });

    if (!name) {
      fail(`Falta el "${CATALOG_HEADERS.name}".`);
      continue;
    }

    const nameKey = normalizeLookupKey(name);

    const previousRow = seenNames.get(nameKey);
    if (previousRow !== undefined) {
      fail(`Este producto ya venía en la fila ${previousRow} del archivo.`);
      continue;
    }
    seenNames.set(nameKey, row.__row);

    const existingCategory = lookups.existingNames.get(nameKey);
    if (existingCategory !== undefined) {
      results.push({
        row: row.__row,
        code: '',
        name,
        status: 'skipped',
        message: `Ya existe en el catálogo, en "${existingCategory}". Si de verdad es otro producto, créalo a mano.`,
      });
      continue;
    }

    // Categoría y unidad son convenciones: solo se acepta lo que exista en la
    // base. La validación del Excel es ayuda, pero se salta pegando valores, así
    // que esta es la que de verdad protege.
    if (isBlank(row.category)) {
      fail(`Falta la "${CATALOG_HEADERS.category}". Elígela de la lista desplegable.`);
      continue;
    }

    const categoryMatches = lookups.categoryIdsByText.get(normalizeLookupKey(row.category!)) ?? [];
    if (categoryMatches.length === 0) {
      fail(
        `La categoría "${row.category}" no existe. Elige una de la lista desplegable (están todas en la hoja "Listas").`
      );
      continue;
    }
    if (categoryMatches.length > 1) {
      fail(
        `"${row.category}" existe bajo varias categorías. Escríbela completa, como "Padre > ${row.category}", tal como aparece en la hoja "Listas".`
      );
      continue;
    }

    if (isBlank(row.unit)) {
      fail(`Falta la "${CATALOG_HEADERS.unit}". Elígela de la lista desplegable.`);
      continue;
    }

    const unitMatches = lookups.unitIdsByText.get(normalizeLookupKey(row.unit!)) ?? [];
    if (unitMatches.length === 0) {
      fail(
        `La unidad "${row.unit}" no existe. Elige una de la lista desplegable (están todas en la hoja "Listas").`
      );
      continue;
    }
    if (unitMatches.length > 1) {
      fail(`La unidad "${row.unit}" coincide con varias. Escríbela como aparece en la hoja "Listas".`);
      continue;
    }

    const flags = {
      isAncestralFood: parseFlag(row.ancestral),
      isMedicinalPlant: parseFlag(row.medicinal),
      isNonFood: parseFlag(row.nonFood),
    };
    const invalidFlag = (
      [
        ['ancestral', flags.isAncestralFood],
        ['medicinal', flags.isMedicinalPlant],
        ['nonFood', flags.isNonFood],
      ] as [CatalogField, boolean | null][]
    ).find(([, value]) => value === null);

    if (invalidFlag) {
      fail(`La columna "${CATALOG_HEADERS[invalidFlag[0]]}" solo acepta "Sí" o "No".`);
      continue;
    }

    // El id se genera acá porque el siigo_id se deriva de él, y esa columna es
    // NOT NULL, UNIQUE y con CHECK de formato, sin default en la base.
    const id = crypto.randomUUID();
    const slug = uniqueSlug(name, takenSlugs);

    valid.push({
      row: row.__row,
      id,
      name,
      slug,
      siigoId: generateSiigoCode(id),
      categoryId: categoryMatches[0],
      defaultUnitId: unitMatches[0],
      description: isBlank(row.description) ? null : row.description!.trim(),
      daneUnitCode: isBlank(row.daneCode) ? null : row.daneCode!.trim(),
      daneUnitName: isBlank(row.daneUnit) ? null : row.daneUnit!.trim(),
      isAncestralFood: flags.isAncestralFood!,
      isMedicinalPlant: flags.isMedicinalPlant!,
      isNonFood: flags.isNonFood!,
    });
  }

  return { valid, results };
}
