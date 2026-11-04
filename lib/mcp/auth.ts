import { timingSafeEqual } from 'node:crypto';

/**
 * Meteor se autentica con un token fijo por entorno (`METEOR_MCP_TOKEN`), que va
 * en `Authorization: Bearer …`. No es la sesión de un usuario: quién es el
 * usuario lo dice el teléfono de cada llamada (`identity.ts`).
 */

/** Por debajo de esto un token se adivina: se rechaza aunque coincida. */
export const MIN_TOKEN_LENGTH = 32;

export function bearerFrom(header: string | null | undefined): string | null {
  const match = /^Bearer\s+(.+)$/i.exec(header?.trim() ?? '');
  return match ? match[1].trim() : null;
}

/** Compara en tiempo constante, para que la demora no delate cuánto acertó. */
export function isValidMcpToken(given: string | null, expected: string | null): boolean {
  if (!given || !expected || expected.length < MIN_TOKEN_LENGTH) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * La puerta de todo lo que llama Meteor (el MCP y la consulta de avisos):
 * `null` si el token es el del entorno; si no, la respuesta que se devuelve.
 * Sin token configurado, 503: el entorno no tiene a Meteor habilitado.
 */
export function meteorAuthError(request: Request, expected: string | null): Response | null {
  if (!expected) return Response.json({ error: 'Meteor no está habilitado en este entorno.' }, { status: 503 });
  if (!isValidMcpToken(bearerFrom(request.headers.get('authorization')), expected)) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }
  return null;
}
