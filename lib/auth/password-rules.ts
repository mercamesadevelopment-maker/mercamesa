/**
 * El mínimo de una contraseña que se fija al aceptar una invitación.
 *
 * Es el mismo de Supabase (`minimum_password_length` en `supabase/config.toml`)
 * y el de la página. Hace falta repetirlo en el servidor porque la contraseña se
 * guarda con la API de administración (`updateUserById`), que no pasa por la
 * política de la sesión del usuario.
 */
export const MIN_INVITE_PASSWORD_LENGTH = 6;

/** El mensaje de error, o `null` si la contraseña sirve. */
export function invitePasswordError(password: unknown): string | null {
  if (typeof password !== 'string' || password.length === 0) return 'La contraseña es un campo obligatorio.';
  if (password.length < MIN_INVITE_PASSWORD_LENGTH) {
    return `La contraseña debe tener al menos ${MIN_INVITE_PASSWORD_LENGTH} caracteres.`;
  }
  return null;
}
