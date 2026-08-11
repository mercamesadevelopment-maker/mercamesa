/**
 * Código propio de la tienda para un producto publicado (`store_products.code`),
 * del estilo de un código de barras: lo escribe el vendedor y debe ser único
 * dentro de su tienda.
 *
 * Una sola fuente para el formato y los mensajes, usada por los formularios, los
 * endpoints y la carga masiva, para que el vendedor lea siempre lo mismo.
 */

/** Mismo límite del campo `barcode` de Siigo, con quien el proyecto se integra. */
export const PRODUCT_CODE_MAX_LENGTH = 50;

/** Recorta y colapsa espacios internos: "  A 12 " y "A  12" son el mismo código. */
export function normalizeProductCode(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.trim().replace(/\s+/g, ' ');
}

/**
 * Clave para comparar unicidad. Va en mayúsculas igual que el índice
 * `store_products_store_code_key`, que usa `upper(code)`.
 */
export function productCodeKey(input: unknown): string {
  return normalizeProductCode(input).toUpperCase();
}

/** Devuelve el mensaje de error, o null si el código es válido. */
export function validateProductCode(input: unknown): string | null {
  const code = normalizeProductCode(input);

  if (!code) return 'El código del producto es obligatorio.';

  if (code.length > PRODUCT_CODE_MAX_LENGTH) {
    return `El código del producto no puede pasar de ${PRODUCT_CODE_MAX_LENGTH} caracteres.`;
  }

  return null;
}

/** Mensaje único para el choque de unicidad, venga del pre-chequeo o del 23505. */
export function duplicateProductCodeMessage(code: string): string {
  return `Ya tienes otro producto con el código "${normalizeProductCode(code)}".`;
}

/** Nombre del índice único, para reconocer el error 23505 de Postgres. */
export const PRODUCT_CODE_UNIQUE_INDEX = 'store_products_store_code_key';
