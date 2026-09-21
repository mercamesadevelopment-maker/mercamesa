/**
 * Traduce los errores de Supabase Auth a frases en español.
 *
 * Existe porque devolver `error.message` tal cual saca a la pantalla el texto
 * de la librería —«User already registered», «Invalid login credentials»—: está
 * en inglés, no dice qué hacer a continuación y expone la implementación.
 *
 * Mismo criterio que `lib/db/unique-violation.ts`, que ya resolvía esto para los
 * errores de Postgres: la clave del error es lo que se mira, y el mensaje se
 * escribe una sola vez en un lugar compartido.
 */

/** Forma mínima de un `AuthError`; evita atarse al tipo de supabase-js. */
export interface AuthErrorLike {
  code?: string | null;
  message?: string | null;
  status?: number | null;
}

/**
 * Código estable que viaja hasta el cliente para que la interfaz pueda
 * reaccionar (por ejemplo, ofrecer "Iniciar sesión") sin comparar textos.
 */
export type AuthErrorCode =
  | 'email_exists'
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'weak_password'
  | 'same_password'
  | 'rate_limited'
  | 'invalid_email'
  | 'user_not_found'
  | 'session_expired';

const MESSAGES: Record<AuthErrorCode, string> = {
  email_exists:
    'Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.',
  invalid_credentials: 'Correo o contraseña incorrectos.',
  email_not_confirmed:
    'Tu correo todavía no está confirmado. Revisa tu bandeja de entrada.',
  weak_password:
    'La contraseña es muy débil. Usa al menos 8 caracteres, combinando letras y números.',
  same_password: 'La nueva contraseña debe ser distinta de la actual.',
  rate_limited: 'Demasiados intentos seguidos. Espera unos minutos y vuelve a intentarlo.',
  invalid_email: 'El correo electrónico no tiene un formato válido.',
  user_not_found: 'No encontramos una cuenta con ese correo.',
  session_expired: 'Tu sesión expiró. Vuelve a iniciar sesión para continuar.',
};

/**
 * `error_code` de la API de Auth → nuestro código.
 *
 * Se mira primero porque es el campo estable de supabase-js v2: el texto del
 * mensaje cambia entre versiones, el código no.
 */
const BY_CODE: Record<string, AuthErrorCode> = {
  user_already_exists: 'email_exists',
  email_exists: 'email_exists',
  invalid_credentials: 'invalid_credentials',
  email_not_confirmed: 'email_not_confirmed',
  weak_password: 'weak_password',
  same_password: 'same_password',
  over_request_rate_limit: 'rate_limited',
  over_email_send_rate_limit: 'rate_limited',
  over_sms_send_rate_limit: 'rate_limited',
  email_address_invalid: 'invalid_email',
  user_not_found: 'user_not_found',
  session_not_found: 'session_expired',
  session_expired: 'session_expired',
  refresh_token_not_found: 'session_expired',
};

/**
 * Respaldo por texto, para los errores que llegan sin `code`.
 *
 * Las versiones anteriores de GoTrue no lo mandaban, y en la base hay cuentas
 * creadas desde entonces; sin esto, esos casos caerían al mensaje genérico.
 */
const BY_MESSAGE: Array<[string, AuthErrorCode]> = [
  ['already registered', 'email_exists'],
  ['already been registered', 'email_exists'],
  ['invalid login credentials', 'invalid_credentials'],
  ['email not confirmed', 'email_not_confirmed'],
  ['password should be at least', 'weak_password'],
  ['password should contain', 'weak_password'],
  ['different from the old password', 'same_password'],
  ['rate limit', 'rate_limited'],
  ['too many requests', 'rate_limited'],
  ['invalid email', 'invalid_email'],
  ['unable to validate email address', 'invalid_email'],
  ['user not found', 'user_not_found'],
];

/** Identifica el error, o `null` si no es ninguno de los conocidos. */
export function authErrorCode(error: AuthErrorLike | null | undefined): AuthErrorCode | null {
  if (!error) return null;

  const byCode = error.code ? BY_CODE[error.code] : undefined;
  if (byCode) return byCode;

  const text = (error.message ?? '').toLowerCase();
  if (!text) return null;

  for (const [fragment, code] of BY_MESSAGE) {
    if (text.includes(fragment)) return code;
  }

  return null;
}

/**
 * Mensaje listo para mostrar, más el código para que la UI pueda reaccionar.
 *
 * Lo que no esté en el mapa devuelve el `fallback` de quien llama — nunca el
 * texto en inglés. El original se registra en consola para poder depurarlo.
 *
 * @param contexto De dónde viene el error, para ubicarlo en los logs.
 */
export function authErrorMessage(
  error: AuthErrorLike | null | undefined,
  fallback: string,
  contexto?: string
): { message: string; code: AuthErrorCode | null } {
  const code = authErrorCode(error);

  if (!code) {
    console.error(`[auth] error sin traducción${contexto ? ` en ${contexto}` : ''}:`, {
      code: error?.code ?? null,
      message: error?.message ?? null,
      status: error?.status ?? null,
    });
    return { message: fallback, code: null };
  }

  return { message: MESSAGES[code], code };
}
