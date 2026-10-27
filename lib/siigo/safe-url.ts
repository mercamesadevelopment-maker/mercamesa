/**
 * Un enlace de una respuesta de Siigo, solo si es `https`. No se guarda ni se
 * pinta en la página cualquier cosa que venga en la respuesta (un `javascript:`
 * en un `href` se ejecutaría al hacer clic).
 */
export function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    return new URL(value).protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}
