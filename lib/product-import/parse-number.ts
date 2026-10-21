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
