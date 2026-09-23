/**
 * El archivo plano de dispersión de BBVA Global C@sh.
 *
 * Función pura: no toca red ni base de datos, igual que `computeOrderPricing` y
 * `buildBookingPayload`. Todo lo que necesita llega por parámetro, y así se
 * puede comprobar contra el ejemplo que entregó el banco sin montar nada.
 *
 * El formato es posicional y no perdona: cada campo ocupa un rango fijo de
 * columnas, y correr un carácter desplaza todo lo que sigue. Un archivo mal
 * armado no falla con un error, se procesa mal.
 *
 * Reglas, de `docs/dispersiones.md`:
 *
 *   - Campos ALFANUMÉRICOS: el dato a la izquierda, espacios a la derecha.
 *   - Campos NUMÉRICOS: el dato a la derecha, ceros a la izquierda.
 *   - El dinero se parte en dos campos, entero y decimal.
 *
 * Y tres cosas que la tabla no dice pero el ejemplo del banco sí:
 *
 *   1. El cierre `910` mide 55 caracteres, no 170: su último campo es "Libre" y
 *      es opcional, así que se omite. Los demás registros sí van a 170.
 *   2. No hay tildes: Bogotá aparece como "BOGOT DC". El archivo es ASCII.
 *   3. En el registro 130, los campos numéricos opcionales van con espacios y no
 *      con ceros, al revés de lo que dice la norma. Manda el ejemplo.
 */

/** Todos los registros menos el de cierre. */
export const LARGO_REGISTRO = 170;

/** El cierre omite su campo "Libre" final, que es opcional. */
export const LARGO_CIERRE = 55;

/** 1 = Transferencias. Define también la extensión del archivo (.TRA). */
const TIPO_ARCHIVO = '1';

/** Abono en cuenta. Es la única forma de pago que usa la plataforma. */
const FORMA_PAGO_ABONO = '1';

const BANCO_BBVA = '0013';

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
 * NO se pasa a mayúsculas. El ejemplo del banco trae el concepto en minúsculas
 * ("Pago facturas proveedores"), así que no es un requisito del formato: los
 * nombres salen en mayúsculas ahí porque así estaban en los datos de origen.
 *
 * Y la tilde se transcribe en vez de borrarse, al revés de lo que hizo quien
 * generó el ejemplo —ahí "Bogotá" quedó como "BOGOT DC", con la letra perdida—.
 * El campo es alfanumérico libre, así que "BOGOTA" le sirve igual al banco y se
 * lee mejor.
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

/** Espacios. Para los campos opcionales que el ejemplo deja en blanco. */
function blancos(largo: number): string {
  return ' '.repeat(largo);
}

/**
 * Parte un monto en entero y decimal, como los pide el archivo.
 *
 * En pesos no hay centavos, así que la parte decimal es siempre '00'. El ejemplo
 * del banco trae 1,15 porque es una prueba, no porque la plataforma maneje
 * fracciones.
 */
export function montoPartido(valor: number): { entero: string; decimal: string } {
  const redondeado = Math.round(valor * 100);
  return {
    entero: padN(Math.floor(redondeado / 100), 13),
    decimal: padN(redondeado % 100, 2),
  };
}

/** AAAAMMDD, la única forma de fecha que entiende el archivo. */
export function fechaArchivo(fecha: Date): string {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

// ---------------------------------------------------------------------------
// Los datos que necesita
// ---------------------------------------------------------------------------

/** El ordenante: quién paga. Sale de `payout_settings_history`. */
export interface Ordenante {
  documentType: string;
  documentNumber: string;
  dv: string;
  suffix: string;
  name: string;
  address: string;
  city: string;
  bbvaOfficeCode: string;
  bbvaAccountNumber: string;
  emitterKey: string;
  paymentConcept: string;
}

/** Un beneficiario: una tienda con el total de sus pedidos. */
export interface Beneficiario {
  bankCode: string;
  accountKind: 'checking' | 'savings';
  accountNumber: string;
  /** Solo si `bankCode` es BBVA. */
  bbvaOfficeCode?: string | null;
  documentType: string;
  documentNumber: string;
  documentDv: string;
  name: string;
  address?: string | null;
  email?: string | null;
  /** La suma de sus pedidos en esta liquidación. */
  amount: number;
  /** Referencia de conciliación, campo obligatorio del registro 210. */
  reference: string;
}

export interface ArchivoDispersion {
  ordenante: Ordenante;
  beneficiarios: Beneficiario[];
  /** Cuándo se arma el archivo. */
  createdAt: Date;
  /** Cuándo lo procesará el banco. */
  processAt: Date;
  /** Consecutivo ya con el desfase aplicado. Se escribe como COA{5 dígitos}.TRA */
  consecutive: number;
}

/** '01' corriente, '02' ahorros: los dos primeros dígitos de la cuenta BBVA. */
function codigoTipoCuenta(kind: 'checking' | 'savings'): string {
  return kind === 'checking' ? '01' : '02';
}

export function nombreDeArchivo(consecutive: number): string {
  if (consecutive > 99999) {
    throw new FlatFileError(
      'El consecutivo del archivo pasó de 99999 y ya no cabe en el nombre.'
    );
  }
  return `COA${String(consecutive).padStart(5, '0')}.TRA`;
}

// ---------------------------------------------------------------------------
// Los registros
// ---------------------------------------------------------------------------

/**
 * Los campos 3 a 6 se repiten idénticos en TODOS los registros del archivo:
 * tipo y número de identificación del ordenante, su dígito de verificación y el
 * sufijo. Ocupan siempre las posiciones 5 a 24.
 */
function prefijoOrdenante(o: Ordenante): string {
  return padN(o.documentType, 2) + padA(o.documentNumber, 15) + padN(o.dv, 1) + padN(o.suffix, 2);
}

/**
 * Y en los registros de detalle se repite además la identificación del receptor,
 * posiciones 25 a 42.
 */
function prefijoReceptor(b: Beneficiario): string {
  return padA(b.documentType, 2) + padA(b.documentNumber, 15) + padN(b.documentDv, 1);
}

function registro110(a: ArchivoDispersion): string {
  const o = a.ordenante;
  return (
    TIPO_ARCHIVO +
    '110' +
    prefijoOrdenante(o) +
    fechaArchivo(a.createdAt) +
    fechaArchivo(a.processAt) +
    BANCO_BBVA +
    padN(o.bbvaOfficeCode, 4) +
    '00' + // dígitos de verificación de la cuenta ordenante: fijo
    padN(o.bbvaAccountNumber, 10) +
    'COP' +
    '0' + // indicador de devolución del archivo
    padA(nombreDeArchivo(a.consecutive), 12) +
    padA(o.emitterKey, 15) +
    blancos(79)
  );
}

function registro120(o: Ordenante): string {
  return (
    TIPO_ARCHIVO +
    '120' +
    prefijoOrdenante(o) +
    padA(o.name, 36) +
    padA(o.address, 36) +
    blancos(36) + // domicilio 2, opcional
    blancos(38)
  );
}

function registro130(o: Ordenante): string {
  // Código de estado y código postal son numéricos opcionales, pero el ejemplo
  // del banco los deja en blanco y no en ceros. Se sigue el ejemplo.
  return (
    TIPO_ARCHIVO +
    '130' +
    prefijoOrdenante(o) +
    padA(o.city, 36) +
    blancos(2) +
    blancos(5) +
    blancos(103)
  );
}

/**
 * El detalle del pago. Es el registro que decide a dónde va el dinero.
 *
 * La cuenta se escribe por una de dos ramas, y la que no se usa va en ceros:
 *
 *   - BBVA: campos 12-14 (oficina, dígitos y número, donde los dos primeros
 *     dígitos del número son el tipo de cuenta). Campos 15-16 en ceros.
 *   - Otro banco: campos 12-14 en ceros, y la cuenta en los campos 15-16 como
 *     tipo NACHAM más número alfanumérico alineado a la izquierda.
 */
function registro210(a: ArchivoDispersion, b: Beneficiario): string {
  const esBbva = b.bankCode === BANCO_BBVA;
  const tipoCuenta = codigoTipoCuenta(b.accountKind);

  let bloqueBbva: string;
  let bloqueNacham: string;

  if (esBbva) {
    if (!b.bbvaOfficeCode) {
      throw new FlatFileError(
        `La cuenta BBVA de "${b.name}" no tiene código de oficina, que es obligatorio.`
      );
    }
    // 4 oficina + 2 verificación + 10 cuenta, donde la cuenta lleva el tipo
    // adelante y los 8 dígitos finales detrás.
    const ultimosOcho = b.accountNumber.replace(/\D/g, '').slice(-8);
    bloqueBbva = padN(b.bbvaOfficeCode, 4) + '00' + tipoCuenta + padN(ultimosOcho, 8);
    bloqueNacham = padN(0, 2) + padN(0, 17);
  } else {
    bloqueBbva = padN(0, 4) + padN(0, 2) + padN(0, 10);
    // Alineado a la izquierda con espacios a la derecha, dice la norma.
    bloqueNacham = tipoCuenta + padA(b.accountNumber, 17);
  }

  const { entero, decimal } = montoPartido(b.amount);

  return (
    TIPO_ARCHIVO +
    '210' +
    prefijoOrdenante(a.ordenante) +
    prefijoReceptor(b) +
    FORMA_PAGO_ABONO +
    padN(b.bankCode, 4) +
    bloqueBbva +
    bloqueNacham +
    entero +
    decimal +
    fechaArchivo(a.processAt) +
    '00000000' + // fecha límite: solo aplica a cheque o efectivo
    blancos(6) + // código de devolución: lo llena el banco al responder
    padA(b.reference, 15) +
    '0000' + // oficina pagadora: solo aplica a cheque o efectivo
    blancos(32)
  );
}

function registro220(a: ArchivoDispersion, b: Beneficiario): string {
  return (
    TIPO_ARCHIVO +
    '220' +
    prefijoOrdenante(a.ordenante) +
    prefijoReceptor(b) +
    padA(b.name, 36) +
    padA(b.address, 36) +
    blancos(36) + // dirección 2, opcional
    blancos(20)
  );
}

/**
 * Registro de control. Va vacío al enviar: el banco lo devuelve lleno con el
 * resultado de cada operación en el archivo de respuesta.
 */
function registro230(a: ArchivoDispersion, b: Beneficiario): string {
  return (
    TIPO_ARCHIVO +
    '230' +
    prefijoOrdenante(a.ordenante) +
    prefijoReceptor(b) +
    blancos(80) + // detalle de la devolución
    padA(b.email, 48)
  );
}

function registro240(a: ArchivoDispersion, b: Beneficiario): string {
  return (
    TIPO_ARCHIVO +
    '240' +
    prefijoOrdenante(a.ordenante) +
    prefijoReceptor(b) +
    padA(a.ordenante.paymentConcept, 40) +
    blancos(40) + // concepto 2, opcional
    blancos(48)
  );
}

/**
 * El cierre. Mide 55 y no 170 porque su último campo, "Libre", es opcional y el
 * ejemplo del banco lo omite.
 *
 * `totalLineas` cuenta TODAS las líneas del archivo, incluida esta.
 */
function registro910(
  o: Ordenante,
  total: number,
  cantidad210: number,
  totalLineas: number
): string {
  const { entero, decimal } = montoPartido(total);
  return (
    TIPO_ARCHIVO +
    '910' +
    prefijoOrdenante(o) +
    entero +
    decimal +
    padN(cantidad210, 8) +
    padN(totalLineas, 8)
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

  const lineas: string[] = [
    registro110(a),
    registro120(a.ordenante),
    registro130(a.ordenante),
  ];

  let total = 0;
  for (const b of a.beneficiarios) {
    if (b.amount <= 0) {
      throw new FlatFileError(`El pago a "${b.name}" no es mayor que cero.`);
    }
    lineas.push(registro210(a, b), registro220(a, b), registro230(a, b), registro240(a, b));
    total += b.amount;
  }

  // El cierre ya sabe cuántas líneas hay: las de arriba más la suya.
  lineas.push(registro910(a.ordenante, total, a.beneficiarios.length, lineas.length + 1));

  lineas.forEach((linea, i) => {
    const esperado = i === lineas.length - 1 ? LARGO_CIERRE : LARGO_REGISTRO;
    if (linea.length !== esperado) {
      throw new FlatFileError(
        `La línea ${i + 1} (registro ${linea.slice(1, 4)}) mide ${linea.length} y debería medir ${esperado}.`
      );
    }
  });

  return lineas.join('\n');
}
