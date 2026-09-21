import {
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';

/**
 * Teléfonos en un solo formato: E.164 (`+573001234567`).
 *
 * Antes cada formulario guardaba lo que el usuario escribiera, y la base quedó
 * con 10 dígitos sueltos, con `+57` y espacios, e incluso con texto. Eso no es
 * solo desorden: **Pibox recibe el indicativo aparte del número**, así que sin
 * un formato fijo no hay forma de separarlos bien.
 *
 * `libphonenumber-js` y no una expresión regular propia: la longitud y los
 * prefijos válidos cambian por país, y mantener esa tabla a mano es garantía de
 * rechazar números buenos.
 */

/** País por defecto cuando el número viene sin indicativo. */
const DEFAULT_COUNTRY: CountryCode = 'CO';

/**
 * Normaliza a E.164, o `null` si no es un teléfono plausible.
 *
 * Acepta lo que ya está guardado —`3001234567`, `+57 300 123 4567`,
 * `(300) 123-4567`— y rechaza lo que nunca fue un número, como el perfil que
 * tiene un correo en este campo.
 */
export function toE164(
  input: string | null | undefined,
  defaultCountry: CountryCode = DEFAULT_COUNTRY
): string | null {
  if (!input) return null;

  const trimmed = String(input).trim();
  if (!trimmed) return null;

  const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
  if (!parsed || !parsed.isValid()) return null;

  return parsed.number;
}

/** `true` si el valor ya es, o puede convertirse en, un teléfono válido. */
export function isValidPhone(
  input: string | null | undefined,
  defaultCountry: CountryCode = DEFAULT_COUNTRY
): boolean {
  return toE164(input, defaultCountry) !== null;
}

/**
 * Separa el indicativo del número nacional.
 *
 * Es lo que pide Pibox: `{ country_code: '57', phone: '3001234567' }`. Antes el
 * '57' estaba escrito a mano en el mapper, lo que daba igual mientras todos los
 * números fueran colombianos y no trajeran el prefijo — dos supuestos que el
 * selector de país rompe.
 */
export function splitE164(
  input: string | null | undefined
): { countryCode: string; nationalNumber: string } | null {
  const e164 = toE164(input);
  if (!e164) return null;

  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed) return null;

  return {
    countryCode: parsed.countryCallingCode,
    nationalNumber: parsed.nationalNumber,
  };
}

/**
 * Solo los dígitos nacionales, sin indicativo: `3001234567`.
 *
 * Para Siigo, que espera el número como se marca en el país. Para un número
 * colombiano devuelve exactamente lo que se le enviaba antes de este cambio.
 */
export function toNationalDigits(input: string | null | undefined): string | null {
  return splitE164(input)?.nationalNumber ?? null;
}
