import { normalizeText } from '@/src/components/Shared';
import {
  duplicateProductCodeMessage,
  normalizeProductCode,
  productCodeKey,
  validateProductCode,
} from '@/lib/products/product-code';
import { SpreadsheetError, isBlank } from '@/lib/spreadsheet/parse';
import { EXCLUSIVE_PRODUCT_MESSAGE } from '@/lib/catalog/visibility';
import type { ImportRowResult } from '@/lib/spreadsheet/report';
import { TEMPLATE_HEADERS } from './constants';
import type { SellerRow } from './parse';
import type { ImportLookups, ValidatedRow } from './types';

/**
 * Interpreta un número escrito a mano en Excel: tolera "$", espacios, puntos de
 * miles y coma decimal (formato colombiano) además del formato inglés.
 */
export function parseNumber(input: string | undefined): number | null {
  if (!input) return null;

  const cleaned = input.replace(/[^\d.,-]/g, '');
  if (!cleaned || !/\d/.test(cleaned)) return null;

  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');

  let normalized: string;
  if (lastDot !== -1 && lastComma !== -1) {
    // Conviven ambos: el último es el separador decimal, el otro es de miles.
    const decimalSep = lastDot > lastComma ? '.' : ',';
    const thousandSep = decimalSep === '.' ? ',' : '.';
    normalized = cleaned.split(thousandSep).join('').replace(decimalSep, '.');
  } else if (lastComma !== -1) {
    const decimals = cleaned.length - lastComma - 1;
    normalized =
      cleaned.indexOf(',') === lastComma && decimals !== 3
        ? cleaned.replace(',', '.')
        : cleaned.split(',').join('');
  } else if (lastDot !== -1) {
    const isSingle = cleaned.indexOf('.') === lastDot;
    const decimals = cleaned.length - lastDot - 1;
    // "1.200" en Colombia son mil doscientos, no 1,2. Varios puntos ("1.200.000")
    // solo pueden ser separadores de miles; uno solo lo es si deja exactamente
    // tres cifras a la derecha.
    normalized = !isSingle || decimals === 3 ? cleaned.split('.').join('') : cleaned;
  } else {
    normalized = cleaned;
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

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

export function validateRows(rows: SellerRow[], lookups: ImportLookups): ValidationResult {
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
  const seenProductCodes = new Map<string, number>();

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

    const productCodeError = validateProductCode(row.productCode);
    if (productCodeError) {
      fail(`${productCodeError} Es la columna "${TEMPLATE_HEADERS.productCode}".`, product.name);
      continue;
    }

    const productCode = normalizeProductCode(row.productCode);
    const productCodeAsKey = productCodeKey(productCode);

    const previousCodeRow = seenProductCodes.get(productCodeAsKey);
    if (previousCodeRow !== undefined) {
      fail(`Ese código ya lo usaste en la fila ${previousCodeRow} del archivo.`, product.name);
      continue;
    }

    if (lookups.existingProductCodes.has(productCodeAsKey)) {
      fail(duplicateProductCodeMessage(productCode), product.name);
      continue;
    }

    seenProductCodes.set(productCodeAsKey, row.__row);

    let unitId: string | null;
    if (isBlank(row.unit)) {
      unitId = product.defaultUnitId;
      if (!unitId) {
        fail(
          `Este producto no tiene unidad por defecto: escribe la "${TEMPLATE_HEADERS.unit}" en el archivo.`,
          product.name
        );
        continue;
      }
    } else {
      const matches = lookups.unitIdsByText.get(normalizeText(row.unit!).trim()) ?? [];
      if (matches.length === 0) {
        fail(`La unidad "${row.unit}" no existe. Usa una de las de la hoja "Instrucciones".`, product.name);
        continue;
      }
      if (matches.length > 1) {
        fail(
          `La unidad "${row.unit}" coincide con varias unidades de medida. Escríbela como aparece en la hoja "Instrucciones".`,
          product.name
        );
        continue;
      }
      unitId = matches[0];
    }

    const pricePerUnit = parseNumber(row.retailPrice);
    if (pricePerUnit === null || pricePerUnit <= 0) {
      fail(`El "${TEMPLATE_HEADERS.retailPrice}" debe ser un número mayor que cero.`, product.name);
      continue;
    }

    const stock = parseNumber(row.stock);
    if (stock === null || stock < 0) {
      fail(`El "${TEMPLATE_HEADERS.stock}" debe ser un número mayor o igual a cero.`, product.name);
      continue;
    }

    let wholesalePrice: number | null = null;
    if (!isBlank(row.wholesalePrice)) {
      wholesalePrice = parseNumber(row.wholesalePrice);
      if (wholesalePrice === null || wholesalePrice <= 0) {
        fail(`El "${TEMPLATE_HEADERS.wholesalePrice}" debe ser un número mayor que cero o quedar vacío.`, product.name);
        continue;
      }
      if (wholesalePrice > pricePerUnit) {
        fail(
          `El "${TEMPLATE_HEADERS.wholesalePrice}" no puede ser mayor que el "${TEMPLATE_HEADERS.retailPrice}".`,
          product.name
        );
        continue;
      }
    }

    let wholesaleMinQty: number | null = null;
    if (!isBlank(row.wholesaleMinQty)) {
      wholesaleMinQty = parseNumber(row.wholesaleMinQty);
      if (wholesaleMinQty === null || wholesaleMinQty <= 0) {
        fail(`La "${TEMPLATE_HEADERS.wholesaleMinQty}" debe ser un número mayor que cero o quedar vacía.`, product.name);
        continue;
      }
    }

    let minOrderQty = 1;
    if (!isBlank(row.minOrderQty)) {
      const parsed = parseNumber(row.minOrderQty);
      if (parsed === null || parsed <= 0) {
        fail(`El "${TEMPLATE_HEADERS.minOrderQty}" debe ser un número mayor que cero o quedar vacío.`, product.name);
        continue;
      }
      minOrderQty = parsed;
    }

    valid.push({
      row: row.__row,
      code,
      name: product.name,
      productCode,
      catalogProductId: product.id,
      unitId,
      pricePerUnit,
      stock,
      wholesalePrice,
      wholesaleMinQty,
      minOrderQty,
    });
  }

  return { valid, results };
}
