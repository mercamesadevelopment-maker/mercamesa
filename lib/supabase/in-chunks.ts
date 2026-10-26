import { fetchAllRows } from './fetch-all';

/**
 * Ids por consulta en un `.in(...)`. Con listas más largas la URL de PostgREST
 * pasa el tope y la consulta falla.
 */
export const IN_CHUNK_SIZE = 100;

export function chunk<T>(values: T[], size = IN_CHUNK_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));
  return out;
}

/**
 * Todas las filas de una consulta filtrada por una lista de ids que puede ser
 * larga: la parte en bloques y recorre cada bloque con `fetchAllRows`.
 *
 * @example
 * const items = await fetchAllIn(orderIds, (ids, from, to) =>
 *   service.from('order_items').select('id, order_id').in('order_id', ids).range(from, to)
 * );
 */
export async function fetchAllIn<T>(
  ids: string[],
  buildQuery: (ids: string[], from: number, to: number) => PromiseLike<{
    data: unknown[] | null;
    error: { message: string } | null;
  }>
): Promise<T[]> {
  const rows: T[] = [];
  for (const ids_ of chunk([...new Set(ids)])) {
    rows.push(...((await fetchAllRows((from, to) => buildQuery(ids_, from, to))) as T[]));
  }
  return rows;
}
