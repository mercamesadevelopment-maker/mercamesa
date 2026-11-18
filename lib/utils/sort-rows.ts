/**
 * Ordenar las filas de una tabla por una columna, en el navegador. Lo usan las
 * tablas tipo Excel (`EditableGrid`): la tabla dice por qué columna, y quien la
 * usa ordena con esto (o en el servidor, si pagina allá).
 */

export type SortOrder = 'asc' | 'desc';

export interface SortState {
  key: string | null;
  order: SortOrder;
}

export type SortValue = string | number | boolean | null | undefined;

const vacio = (v: SortValue) => v === null || v === undefined || v === '' || (typeof v === 'number' && Number.isNaN(v));

function comparar(a: SortValue, b: SortValue): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return String(a).localeCompare(String(b), 'es', { numeric: true, sensitivity: 'base' });
}

/**
 * Las filas ordenadas, sin tocar el arreglo original. Los vacíos van al final
 * en las dos direcciones, y dos filas iguales conservan su orden (estable).
 */
export function sortRows<T>(rows: T[], valueOf: (row: T) => SortValue, order: SortOrder): T[] {
  const signo = order === 'asc' ? 1 : -1;
  return rows
    .map((row, i) => ({ row, i, v: valueOf(row) }))
    .sort((x, y) => {
      const vx = vacio(x.v);
      const vy = vacio(y.v);
      if (vx || vy) return vx === vy ? x.i - y.i : vx ? 1 : -1;
      return signo * comparar(x.v, y.v) || x.i - y.i;
    })
    .map((x) => x.row);
}

/** El clic en el encabezado: ascendente, descendente y sin orden. */
export function nextSort(actual: SortState, key: string): SortState {
  if (actual.key !== key) return { key, order: 'asc' };
  if (actual.order === 'asc') return { key, order: 'desc' };
  return { key: null, order: 'asc' };
}
