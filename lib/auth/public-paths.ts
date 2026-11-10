/**
 * Las páginas que se abren sin sesión y sin el menú de la app. Las usan el proxy
 * (no redirige al inicio) y el shell (no pinta menú ni barra): una sola lista
 * para que no se puedan separar.
 *
 * `/mcp/cambios` es para el equipo de Meteor, que no tiene cuenta en MercaMesa.
 */
export const PUBLIC_PATHS = ['/', '/accept-invite', '/mcp/cambios'];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname);
}
