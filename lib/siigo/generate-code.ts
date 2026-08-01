/**
 * Genera el código único que Siigo exige para sus productos (`code` en su
 * API): alfanumérico, sin espacios, máximo 30 caracteres, único.
 * Se deriva del UUID del producto (sin guiones, recortado a 30) para
 * garantizar unicidad sin necesitar una tabla de secuencias aparte.
 */
export function generateSiigoCode(productId: string): string {
  return productId.replace(/-/g, '').slice(0, 30);
}
