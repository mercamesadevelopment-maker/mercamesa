/**
 * El dígito de verificación (DV) del NIT.
 *
 * El DV es una suma de control de los dígitos del NIT: si alguien escribe mal un
 * dígito del NIT, o el DV, dejan de corresponder. El banco lo recalcula al
 * procesar la dispersión y rechaza la línea si no coincide —lo confirmó el
 * validador de BBVA—, así que un DV equivocado es un pago que no llega y que
 * nadie nota hasta el día de la dispersión.
 *
 * Por eso se pide escrito y se comprueba, en vez de calcularlo y rellenarlo: si
 * la persona se equivocó en un dígito del NIT, un DV calculado "cuadraría" con
 * el NIT equivocado y el error pasaría. El que escribe ella es el que lo delata.
 *
 * Función pura, igual que `validate-document.ts`: la usan el formulario, la ruta
 * y el generador del archivo, sin que las reglas se separen.
 */

/** Pesos de la DIAN, aplicados desde el dígito de la derecha. */
const PESOS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

/**
 * El DV que le corresponde a un NIT, o `null` si el NIT no es un número usable
 * (vacío, con letras, o más largo de lo que cubren los pesos).
 */
export function nitCheckDigit(nit: string | null | undefined): string | null {
  const digitos = String(nit ?? '').replace(/[\s.\-]/g, '');
  if (!/^\d+$/.test(digitos) || digitos.length > PESOS.length) return null;

  const suma = digitos
    .split('')
    .reverse()
    .reduce((acc, d, i) => acc + Number(d) * PESOS[i], 0);
  const resto = suma % 11;
  return String(resto > 1 ? 11 - resto : resto);
}

/** El mensaje de error si el DV no corresponde al NIT, o `null` si está bien. */
export function validateNitCheckDigit(
  nit: string | null | undefined,
  dv: string | null | undefined
): string | null {
  const esperado = nitCheckDigit(nit);
  if (esperado === null) return 'El NIT debe tener solo números.';
  if (String(dv ?? '').trim() !== esperado) {
    return 'El dígito de verificación no corresponde a ese NIT. Revisa los dos contra el RUT.';
  }
  return null;
}
