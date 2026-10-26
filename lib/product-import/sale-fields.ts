import { normalizeText } from '@/lib/utils/text';
import {
  duplicateProductCodeMessage,
  normalizeProductCode,
  productCodeKey,
  validateProductCode,
} from '@/lib/products/product-code';
import { isBlank } from '@/lib/spreadsheet/parse';
import { TEMPLATE_HEADERS } from './constants';
import { parseNumber } from './parse-number';
import type { ImportLookups } from './types';

/** Lo que una fila dice de cómo la tienda vende el producto. Es igual en las dos hojas. */
export interface SaleFieldsInput {
  productCode?: string;
  unit?: string;
  retailPrice?: string;
  stock?: string;
  wholesalePrice?: string;
  wholesaleMinQty?: string;
  minOrderQty?: string;
}

export interface SaleFields {
  productCode: string;
  unitId: string;
  pricePerUnit: number;
  stock: number;
  wholesalePrice: number | null;
  wholesaleMinQty: number | null;
  minOrderQty: number;
}

export interface SaleFieldsContext {
  lookups: Pick<ImportLookups, 'unitIdsByText' | 'existingProductCodes'>;
  /** Códigos ya usados en el archivo (en las dos hojas) -> dónde, para el mensaje. */
  seenProductCodes: Map<string, string>;
  /** Dónde está esta fila, como se le dice al tendero: «la fila 5». */
  where: string;
  /** Unidad si la fila no trae una. Sin ella, la unidad es obligatoria. */
  defaultUnitId: string | null;
}

/**
 * Valida el código, la unidad, los precios, el stock y los mínimos de una fila.
 * Devuelve los valores listos para `store_products`, o el mensaje para el
 * tendero. El código solo se reserva cuando toda la fila es válida.
 */
export function validateSaleFields(
  row: SaleFieldsInput,
  context: SaleFieldsContext
): { ok: true; fields: SaleFields } | { ok: false; message: string } {
  const fail = (message: string) => ({ ok: false as const, message });

  const productCodeError = validateProductCode(row.productCode);
  if (productCodeError) {
    return fail(`${productCodeError} Es la columna "${TEMPLATE_HEADERS.productCode}".`);
  }

  const productCode = normalizeProductCode(row.productCode);
  const productCodeAsKey = productCodeKey(productCode);

  const previous = context.seenProductCodes.get(productCodeAsKey);
  if (previous !== undefined) {
    return fail(`Ese código ya lo usaste en ${previous} del archivo.`);
  }

  if (context.lookups.existingProductCodes.has(productCodeAsKey)) {
    return fail(duplicateProductCodeMessage(productCode));
  }

  let unitId: string | null;
  if (isBlank(row.unit)) {
    unitId = context.defaultUnitId;
    if (!unitId) {
      return fail(`Falta la "${TEMPLATE_HEADERS.unit}". Elígela de la lista desplegable.`);
    }
  } else {
    const matches = context.lookups.unitIdsByText.get(normalizeText(row.unit!).trim()) ?? [];
    if (matches.length === 0) {
      return fail(`La unidad "${row.unit}" no existe. Elígela de la lista desplegable (están todas en la hoja "Listas").`);
    }
    if (matches.length > 1) {
      return fail(`La unidad "${row.unit}" coincide con varias unidades de medida. Escríbela como aparece en la hoja "Listas".`);
    }
    unitId = matches[0];
  }

  const pricePerUnit = parseNumber(row.retailPrice);
  if (pricePerUnit === null || pricePerUnit <= 0) {
    return fail(`El "${TEMPLATE_HEADERS.retailPrice}" debe ser un número mayor que cero.`);
  }

  const stock = parseNumber(row.stock);
  if (stock === null || stock < 0) {
    return fail(`El "${TEMPLATE_HEADERS.stock}" debe ser un número mayor o igual a cero.`);
  }

  let wholesalePrice: number | null = null;
  if (!isBlank(row.wholesalePrice)) {
    wholesalePrice = parseNumber(row.wholesalePrice);
    if (wholesalePrice === null || wholesalePrice <= 0) {
      return fail(`El "${TEMPLATE_HEADERS.wholesalePrice}" debe ser un número mayor que cero o quedar vacío.`);
    }
    if (wholesalePrice > pricePerUnit) {
      return fail(`El "${TEMPLATE_HEADERS.wholesalePrice}" no puede ser mayor que el "${TEMPLATE_HEADERS.retailPrice}".`);
    }
  }

  let wholesaleMinQty: number | null = null;
  if (!isBlank(row.wholesaleMinQty)) {
    wholesaleMinQty = parseNumber(row.wholesaleMinQty);
    if (wholesaleMinQty === null || wholesaleMinQty <= 0) {
      return fail(`La "${TEMPLATE_HEADERS.wholesaleMinQty}" debe ser un número mayor que cero o quedar vacía.`);
    }
  }

  let minOrderQty = 1;
  if (!isBlank(row.minOrderQty)) {
    const parsed = parseNumber(row.minOrderQty);
    if (parsed === null || parsed <= 0) {
      return fail(`El "${TEMPLATE_HEADERS.minOrderQty}" debe ser un número mayor que cero o quedar vacío.`);
    }
    minOrderQty = parsed;
  }

  context.seenProductCodes.set(productCodeAsKey, context.where);

  return {
    ok: true,
    fields: { productCode, unitId, pricePerUnit, stock, wholesalePrice, wholesaleMinQty, minOrderQty },
  };
}
