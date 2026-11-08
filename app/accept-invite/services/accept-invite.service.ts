/**
 * Las dos llamadas de la página de aceptar invitación.
 *
 * La sesión va en `Authorization: Bearer` además de la cookie: hay navegadores
 * (el de Gmail por dentro, por ejemplo) que no la conservan entre que se abre el
 * enlace y se envía el formulario.
 */

const RUTA = '/api/auth/accept-invite';

function conSesion(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface InvitationInfo {
  authenticated: boolean;
  email?: string;
  hasInvite?: boolean;
  invitationType?: string | null;
  roleLabel?: string | null;
  storeName?: string;
  marketplaceName?: string | null;
}

export async function getInvitation(token: string | null): Promise<InvitationInfo> {
  const res = await fetch(RUTA, { headers: conSesion(token) });
  const json = await res.json().catch(() => ({}));
  return res.ok ? (json as InvitationInfo) : { authenticated: false };
}

export async function acceptInvitation(
  token: string | null,
  body: Record<string, unknown>
): Promise<{ redirectUrl: string | null }> {
  const res = await fetch(RUTA, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...conSesion(token) },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Error al completar el registro.');
  return { redirectUrl: json.redirectUrl ?? null };
}
