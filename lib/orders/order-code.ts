/**
 * Código visible del pedido, el mismo para comprador, vendedor y admin.
 *
 * El código real lo asigna la base de datos (formato MM-2026-001017-1). El
 * degradado a UUID recortado existe solo por si alguna consulta todavía no
 * selecciona la columna `code`; ningún pedido guardado carece de ella.
 */
export function formatOrderCode(code?: string | null, fallbackId?: string | null): string {
  if (code) return code.toUpperCase();
  if (fallbackId) return `MM-${fallbackId.substring(0, 8).toUpperCase()}`;
  return '—';
}
