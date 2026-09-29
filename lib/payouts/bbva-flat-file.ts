/**
 * El archivo plano de dispersión de BBVA NetCash, formato POR LÍNEAS.
 *
 * Función pura: no toca red ni base de datos, igual que `computeOrderPricing` y
 * `buildBookingPayload`. Todo lo que necesita llega por parámetro, y así se
 * puede comprobar contra los ejemplos que entregó el banco sin montar nada.
 *
 * El formato es posicional y no perdona: cada campo ocupa un rango fijo de
 * columnas, y correr un carácter desplaza todo lo que sigue. Un archivo mal
 * armado no falla con un error, se procesa mal.
 *
 * La estructura está en `docs/dispersiones/pagosPorLineas.md` y hay dos
 * ejemplos: `ArchivoLineasBBVA.txt` (cuentas) y `PlanoLlavesBBVA.txt` (llaves
 * Bre-B). A diferencia del formato de registros que había antes, aquí no hay
 * encabezado ni cierre ni datos del ordenante: **una línea por pago**.
 *
 * Reglas del documento:
 *
 *   - Campos ALFANUMÉRICOS: el dato a la izquierda, espacios a la derecha.
 *   - Campos NUMÉRICOS: el dato a la derecha, ceros a la izquierda.
 *   - El dinero se parte en dos campos, entero y decimal.
 *
 * Y donde el documento y los ejemplos no coinciden, lo que se decidió:
 *
 *   1. Largo de línea: el documento lista hasta el Concepto 22 (posición 1121),
 *      pero los dos ejemplos terminan en el Concepto 1. Se sigue el de llaves,
 *      el único bien relleno: 281 caracteres.
 *   2. Cuenta BBVA, posiciones 40–58: el documento pide `00` y ceros, el
 *      ejemplo trae espacios. Se sigue el documento.
 *   3. Tildes: el ejemplo de cuentas las trae en UTF-8 ("García"), pero el
 *      formato cuenta bytes y una letra con tilde ocupa dos. Se transcriben a
 *      ASCII ("Garcia").
 *   4. Saltos de línea: CRLF, con uno al final, como el ejemplo de llaves.
 */

import { validateNitCheckDigit } from '@/lib/identification/nit';

/** Hasta el Concepto 1, como el ejemplo de llaves del banco. */
export const LARGO_LINEA = 281;

/** Lo que cabe en el campo de cuenta Nacham, donde va la llave. */
export const LARGO_MAXIMO_LLAVE = 17;

/** Abono en cuenta. También aplica a las llaves. */
const FORMA_PAGO_ABONO = '1';

const BANCO_BBVA = '0013';

/** Código fijo de las líneas pagadas con llave Bre-B. No es un banco. */
const BANCO_LLAVE_BREB = '9999';

/**
 * Tipo de cuenta de una llave. Los dos ejemplos del banco traen `02`, una con
 * llave de celular y otra con llave de cédula; no hay indicio de que varíe.
 */
const TIPO_CUENTA_LLAVE = '02';

/** Los únicos tipos de identificación que acepta el formato. */
const TIPOS_DOCUMENTO = ['01', '02', '03', '04', '05'];

const TIPO_DOCUMENTO_NIT = '03';

export class FlatFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FlatFileError';
  }
}

// ---------------------------------------------------------------------------
// Relleno
// ---------------------------------------------------------------------------

/**
 * Deja solo ASCII imprimible: descompone los acentos y bota las marcas, para
 * que "Bogotá" quede "Bogota" y no "Bogot?" ni dos bytes donde cabía uno.
 *
 * Ojo: un carácter fuera de ASCII ocuparía más de un byte, y el banco cuenta
 * BYTES, no caracteres. Por eso no basta con truncar.
 *
 * NO se pasa a mayúsculas: el ejemplo de cuentas trae "juan garcía" en
 * minúsculas, así que no es un requisito del formato.
 */
function aAscii(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7E]/g, '');
}

/** Campo alfanumérico: a la izquierda, espacios a la derecha, truncado. */
export function padA(valor: string | null | undefined, largo: number): string {
  return aAscii(String(valor ?? '')).slice(0, largo).padEnd(largo, ' ');
}

/**
 * Campo numérico: a la derecha, ceros a la izquierda.
 *
 * Si el valor no cabe se lanza en vez de truncar. Truncar un número es cambiarlo
 * —una cuenta de 11 dígitos recortada a 10 es la cuenta de otra persona—, y es
 * preferible no generar el archivo a generar uno que paga mal.
 */
export function padN(valor: string | number | null | undefined, largo: number): string {
  const limpio = String(valor ?? '').replace(/\D/g, '');
  if (limpio.length > largo) {
    throw new FlatFileError(
      `El valor "${valor}" no cabe en un campo numérico de ${largo} posiciones.`
    );
  }
  return limpio.padStart(largo, '0');
}

function ceros(largo: number): string {
  return '0'.repeat(largo);
}

function blancos(largo: number): string {
  return ' '.repeat(largo);
}

/**
 * Parte un monto en entero y decimal, como los pide el archivo.
 *
 * En pesos no hay centavos, así que la parte decimal es siempre '00'.
 */
export function montoPartido(valor: number): { entero: string; decimal: string } {
  const redondeado = Math.round(valor * 100);
  return {
    entero: padN(Math.floor(redondeado / 100), 13),
    decimal: padN(redondeado % 100, 2),
  };
}

// ---------------------------------------------------------------------------
// Los datos que necesita
// ---------------------------------------------------------------------------

/** Un beneficiario: una tienda con el total de sus pedidos. */
export interface Beneficiario {
  /** Cuenta bancaria o llave Bre-B: decide qué rama de la línea se escribe. */
  paymentMethod: 'account' | 'breb';
  /** Solo si `paymentMethod` es 'breb'. */
  brebKey?: string | null;
  /** Solo si `paymentMethod` es 'account'. */
  bankCode?: string | null;
  accountKind?: 'checking' | 'savings' | null;
  accountNumber?: string | null;
  /** Solo si `bankCode` es BBVA. */
  bbvaOfficeCode?: string | null;
  documentType: string;
  documentNumber: string;
  documentDv: string;
  name: string;
  address: string;
  email?: string | null;
  /** La suma de sus pedidos en esta liquidación. */
  amount: number;
}

export interface ArchivoDispersion {
  beneficiarios: Beneficiario[];
  /** Concepto 1 de cada línea: lo que verá la tienda en su extracto. */
  paymentConcept: string;
}

export function nombreDeArchivo(consecutive: number): string {
  if (consecutive > 99999) {
    throw new FlatFileError('El consecutivo del archivo pasó de 99999 y ya no cabe en el nombre.');
  }
  return `DISPERSION_${String(consecutive).padStart(5, '0')}.txt`;
}

// ---------------------------------------------------------------------------
// La línea
// ---------------------------------------------------------------------------

/**
 * Posiciones 3–18: el número de identificación con el dígito de verificación al
 * final. Solo el NIT lleva DV; para los demás documentos es un 0.
 *
 * El campo es numérico. Un documento con letras —un pasaporte, típicamente— no
 * se puede escribir, y `padN` le quitaría las letras en silencio: se rechaza.
 */
function identificacion(b: Beneficiario): string {
  if (!TIPOS_DOCUMENTO.includes(b.documentType)) {
    throw new FlatFileError(
      `"${b.name}" tiene un tipo de documento (${b.documentType}) que el archivo no acepta.`
    );
  }
  const numero = String(b.documentNumber ?? '').trim();
  if (!/^\d+$/.test(numero)) {
    throw new FlatFileError(
      `El documento de "${b.name}" tiene caracteres que no son números, y el archivo solo acepta números.`
    );
  }
  const esNit = b.documentType === TIPO_DOCUMENTO_NIT;
  const dv = esNit ? String(b.documentDv ?? '0') : '0';
  // El banco recalcula el DV del NIT y rechaza la línea si no corresponde. La
  // ruta ya lo comprueba al registrar la cuenta; esto es la última red, por si
  // alguna fila llegó a la base por otro camino.
  if (esNit && validateNitCheckDigit(numero, dv)) {
    throw new FlatFileError(
      `El dígito de verificación del NIT de "${b.name}" no corresponde a su número; el banco rechazaría el pago.`
    );
  }
  return padN(b.documentType, 2) + padN(numero + dv, 16);
}

/**
 * Posiciones 20–58: a dónde va la plata. Tres ramas, y lo que no aplica a la
 * rama elegida va en ceros:
 *
 *   - Llave Bre-B: banco 9999, la llave en la cuenta Nacham.
 *   - Cuenta BBVA: banco 0013 y la cuenta armada en el campo BBVA.
 *   - Otro banco: su código y la cuenta en el campo Nacham.
 */
function destino(b: Beneficiario): string {
  if (b.paymentMethod === 'breb') {
    const llave = String(b.brebKey ?? '').trim();
    if (!llave) {
      throw new FlatFileError(`"${b.name}" se paga por llave Bre-B pero no tiene llave.`);
    }
    if (llave.length > LARGO_MAXIMO_LLAVE || aAscii(llave) !== llave) {
      throw new FlatFileError(
        `La llave Bre-B de "${b.name}" no cabe en el archivo: máximo ${LARGO_MAXIMO_LLAVE} caracteres, sin tildes.`
      );
    }
    return BANCO_LLAVE_BREB + ceros(16) + TIPO_CUENTA_LLAVE + padA(llave, 17);
  }

  if (!b.bankCode || !b.accountKind || !b.accountNumber) {
    throw new FlatFileError(`A la cuenta de "${b.name}" le falta el banco, el tipo o el número.`);
  }

  const cuenta = b.accountNumber.replace(/\D/g, '');

  if (b.bankCode === BANCO_BBVA) {
    if (!b.bbvaOfficeCode) {
      throw new FlatFileError(
        `La cuenta BBVA de "${b.name}" no tiene código de oficina, que es obligatorio.`
      );
    }
    if (cuenta.length < 6) {
      throw new FlatFileError(`El número de la cuenta BBVA de "${b.name}" es demasiado corto.`);
    }
    // Oficina con un 0 adelante (el documento: "se antepone cero"), el tipo de
    // cuenta como 000100/000200 y los 6 últimos dígitos del número.
    const tipo = b.accountKind === 'checking' ? '000100' : '000200';
    return BANCO_BBVA + padN(b.bbvaOfficeCode, 4) + tipo + cuenta.slice(-6) + '00' + ceros(17);
  }

  const tipoNacham = b.accountKind === 'checking' ? '01' : '02';
  if (cuenta.length > 17) {
    throw new FlatFileError(`El número de cuenta de "${b.name}" no cabe en el archivo (máximo 17).`);
  }
  return padN(b.bankCode, 4) + ceros(16) + tipoNacham + padA(cuenta, 17);
}

/** Una línea del archivo: un pago a una tienda. */
export function lineaDePago(b: Beneficiario, concepto: string): string {
  if (!(b.amount > 0)) {
    throw new FlatFileError(`El pago a "${b.name}" no es mayor que cero.`);
  }
  if (!String(b.address ?? '').trim()) {
    throw new FlatFileError(`"${b.name}" no tiene dirección, y el archivo la exige.`);
  }

  const { entero, decimal } = montoPartido(b.amount);

  return (
    identificacion(b) +
    FORMA_PAGO_ABONO +
    destino(b) +
    entero +
    decimal +
    // Fecha límite (año, mes, día) y oficina pagadora: solo aplican a pago en
    // efectivo. Con abono en cuenta van en ceros.
    ceros(4) + ceros(2) + ceros(2) + ceros(4) +
    padA(b.name, 36) +
    padA(b.address, 36) +
    blancos(36) + // dirección 2, opcional
    padA(b.email, 48) +
    padA(concepto, 40)
  );
}

// ---------------------------------------------------------------------------
// El ensamblador
// ---------------------------------------------------------------------------

/**
 * Arma el archivo completo y comprueba el largo de cada línea antes de
 * devolverlo. Esa comprobación es la red de seguridad: si algún día alguien
 * cambia un `padA(…, 36)` por uno de 35, el error aparece acá y no en el portal
 * del banco.
 */
export function construirArchivo(a: ArchivoDispersion): string {
  if (a.beneficiarios.length === 0) {
    throw new FlatFileError('No hay beneficiarios: no hay nada que dispersar.');
  }
  if (!a.paymentConcept.trim()) {
    throw new FlatFileError('Falta el concepto de pago, que es obligatorio en cada línea.');
  }

  const lineas = a.beneficiarios.map((b) => lineaDePago(b, a.paymentConcept));

  lineas.forEach((linea, i) => {
    if (linea.length !== LARGO_LINEA) {
      throw new FlatFileError(
        `La línea ${i + 1} mide ${linea.length} y debería medir ${LARGO_LINEA}.`
      );
    }
  });

  return lineas.join('\r\n') + '\r\n';
}
