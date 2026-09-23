/**
 * Formato de correo, en un solo lugar.
 *
 * Antes estaba duplicada dentro de `request-email-change`, y ningún otro punto
 * que guarda un correo (p. ej. el de contacto de una tienda) la usaba: se podía
 * guardar "no-es-un-correo" sin que nada lo rechazara.
 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value);
}
