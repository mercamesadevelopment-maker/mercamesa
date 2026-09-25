/**
 * El número de identificación.
 *
 * No se validaba en ninguna parte: ni formato, ni obligatorio, ni repetido. El
 * resultado es que hoy 15 de 25 perfiles no tienen ninguno y hay un documento
 * duplicado en la base.
 *
 * Mismo patrón que `lib/stores/validate-store.ts`: función pura que devuelve el
 * primer error o `null`, para poder usarla igual en el formulario y en la ruta
 * sin que las dos reglas se separen con el tiempo.
 */

/** Los `slug` de `identification_types` que hay activos hoy. */
export type DocumentSlug = 'cedula' | 'cedula-extranjeria' | 'pasaporte' | 'nit' | 'rut';

interface Regla {
  /** Si admite letras. El pasaporte las lleva; los demás no. */
  alfanumerico: boolean;
  min: number;
  max: number;
  etiqueta: string;
}

/**
 * El pasaporte es el que obliga a que esto sea por tipo: una regla de "solo
 * dígitos" para todos lo rechazaría, porque los pasaportes llevan letras.
 *
 * Los largos son holgados a propósito. Esto evita erratas y basura, no suplanta
 * a la Registraduría: un rango estrecho de más rechazaría documentos legítimos,
 * que es peor que dejar pasar uno raro.
 */
const REGLAS: Record<DocumentSlug, Regla> = {
  cedula: { alfanumerico: false, min: 6, max: 10, etiqueta: 'La cédula' },
  'cedula-extranjeria': { alfanumerico: false, min: 6, max: 12, etiqueta: 'La cédula de extranjería' },
  pasaporte: { alfanumerico: true, min: 5, max: 20, etiqueta: 'El pasaporte' },
  nit: { alfanumerico: false, min: 9, max: 10, etiqueta: 'El NIT' },
  rut: { alfanumerico: false, min: 9, max: 10, etiqueta: 'El RUT' },
};

/** Quita espacios, puntos y guiones: así los escribe la gente. */
export function normalizeDocumentNumber(valor: string | null | undefined): string {
  return (valor ?? '').replace(/[\s.\-]/g, '').trim();
}

/**
 * @param slug El `slug` del tipo de identificación elegido. Si no se conoce
 *   —un tipo nuevo que el admin agregó— solo se exige que no venga vacío: es
 *   preferible a inventarle un formato y bloquear a quien lo use.
 */
export function validateDocumentNumber(
  numero: string | null | undefined,
  slug: string | null | undefined
): string | null {
  const limpio = normalizeDocumentNumber(numero);

  if (!limpio) return 'El número de identificación es obligatorio.';

  const regla = REGLAS[slug as DocumentSlug];
  if (!regla) {
    return limpio.length > 30 ? 'El número de identificación es demasiado largo.' : null;
  }

  const patron = regla.alfanumerico ? /^[A-Za-z0-9]+$/ : /^\d+$/;
  if (!patron.test(limpio)) {
    return regla.alfanumerico
      ? `${regla.etiqueta} solo puede tener letras y números.`
      : `${regla.etiqueta} solo puede tener números.`;
  }

  if (limpio.length < regla.min || limpio.length > regla.max) {
    return `${regla.etiqueta} debe tener entre ${regla.min} y ${regla.max} caracteres.`;
  }

  return null;
}
