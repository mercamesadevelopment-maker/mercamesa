/**
 * Lee el agregado `tabla(count)` de PostgREST.
 *
 * Con `select('*, catalog_products(count)')` la respuesta no trae un número
 * sino `[{ count: 12 }]`, y con la relación vacía puede venir `[]` o `null`.
 * Normalizarlo acá evita repetir ese detalle en cada ruta y que llegue a la
 * interfaz una forma que no le sirve para nada.
 *
 * Se usa para saber cuántos registros dependen de una fila **antes** de ofrecer
 * borrarla, en vez de dejar que el usuario confirme y recibir el error después.
 */
export function embeddedCount(relation: unknown): number {
  if (Array.isArray(relation)) {
    const first = relation[0] as { count?: unknown } | undefined;
    return typeof first?.count === 'number' ? first.count : 0;
  }

  // PostgREST devuelve el objeto suelto cuando la relación es uno-a-uno.
  if (relation && typeof relation === 'object') {
    const count = (relation as { count?: unknown }).count;
    return typeof count === 'number' ? count : 0;
  }

  return 0;
}
