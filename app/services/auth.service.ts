/**
 * Envía un POST a una ruta de `/api/auth` y devuelve su JSON.
 *
 * Existe porque `res.json()` a secas asume que el servidor siempre responde
 * JSON, y no siempre es así: si la ruta no existe, o el servidor de desarrollo
 * quedó con una compilación vieja, Next devuelve su página 404 en HTML. Eso
 * reventaba con «Unexpected token '<', "<!DOCTYPE "... is not valid JSON», que
 * es lo que veía el usuario en el formulario en vez de un motivo entendible.
 *
 * `fallback` es lo que se muestra cuando la respuesta no trae un `error` propio.
 */
/**
 * Error de una respuesta de la API que conserva su `code`.
 *
 * El mensaje ya viene en español desde el servidor, pero la interfaz a veces
 * necesita distinguir el motivo —por ejemplo, ofrecer "Iniciar sesión" cuando el
 * correo ya tiene cuenta— y compararlo por texto sería frágil.
 */
export class ApiError extends Error {
  readonly code: string | null;
  readonly status: number;
  /** Segundos que faltan para poder reintentar, cuando el servidor los indica. */
  readonly retryAfterSeconds?: number;

  constructor(message: string, code: string | null, status: number, retryAfterSeconds?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

async function post(path: string, body?: unknown, fallback = 'No pudimos completar la operación') {
  const res = await fetch(path, {
    method: 'POST',
    ...(body === undefined
      ? {}
      : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });

  const text = await res.text();

  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Respuesta que no es JSON: se ignora el cuerpo y se informa por estado.
  }

  if (!res.ok) {
    throw new ApiError(
      data?.error || `${fallback} (error ${res.status})`,
      data?.code ?? null,
      res.status,
      data?.retryAfterSeconds
    );
  }

  if (data === null) {
    throw new Error(`${fallback}: el servidor respondió algo inesperado.`);
  }

  return data;
}

export const authService = {
  async login(email: string, password: string) {
    return post('/api/auth/login', { email, password }, 'No pudimos iniciar sesión');
  },

  /**
   * Segundo paso del ingreso de admin y superadmin. Recién acá queda la sesión:
   * el primer paso solo comprueba la contraseña y manda el código.
   */
  async verifyLoginCode(email: string, code: string) {
    return post('/api/auth/verify-login-code', { email, code }, 'No pudimos verificar el código');
  },

  async requestSignupCode(email: string) {
    return post('/api/auth/request-signup-code', { email }, 'No pudimos enviar el código');
  },

  async register(payload: { email: string; password: string; full_name: string; phone?: string; role_id: string; buyer_type?: string; person_type_id?: string; identification_type_id?: string; document_number?: string }) {
    return post('/api/auth/register', payload, 'No pudimos crear la cuenta');
  },

  async registerBuyer(payload: {
    email: string;
    password: string;
    // Ids de `person_types` e `identification_types`: el catálogo lo administra
    // el admin desde Parametrización, ya no es una lista fija en el código.
    person_type_id: string;
    identification_type_id: string;
    document_number: string;
    full_name?: string;
    business_name?: string;
    contact_name?: string;
    phone: string;
    buyer_type: 'retail' | 'wholesale';
    terms_version: string;
    /** Código de 6 dígitos que confirma que el correo existe y es suyo. */
    code: string;
  }) {
    return post('/api/auth/register-buyer', payload, 'No pudimos crear la cuenta');
  },

  async forgotPassword(email: string) {
    return post('/api/auth/forgot-password', { email }, 'No pudimos enviar el código');
  },

  async verifyResetCode(email: string, code: string) {
    const data = await post('/api/auth/verify-reset-code', { email, code }, 'No pudimos verificar el código');
    return data as { reset_token: string };
  },

  async resetPassword(email: string, resetToken: string, newPassword: string) {
    return post(
      '/api/auth/reset-password',
      { email, reset_token: resetToken, new_password: newPassword },
      'No pudimos cambiar la contraseña'
    );
  },

  async logout() {
    return post('/api/auth/logout', undefined, 'No pudimos cerrar la sesión');
  }
};
