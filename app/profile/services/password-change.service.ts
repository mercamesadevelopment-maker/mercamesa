/**
 * Cambio de contraseña en dos llamadas: primero se confirma la contraseña actual
 * y se pide el código al correo, después se aplica el cambio con ese código.
 */

async function handle<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok) {
    const error = new Error(json.error ?? 'Request failed') as Error & {
      retryAfterSeconds?: number;
    };
    // El 429 dice cuántos segundos faltan; se conserva para el contador del
    // botón de reenviar.
    if (json.retryAfterSeconds) error.retryAfterSeconds = json.retryAfterSeconds;
    throw error;
  }
  return json as T;
}

const post = (path: string, body: unknown) =>
  fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

export const passwordChangeService = {
  async requestCode(currentPassword: string) {
    return handle<{ message: string; cooldownSeconds: number }>(
      await post('/api/auth/request-password-change', { current_password: currentPassword })
    );
  },

  async changePassword(code: string, newPassword: string) {
    return handle<{ message: string }>(
      await post('/api/auth/change-password', { code, new_password: newPassword })
    );
  },
};
