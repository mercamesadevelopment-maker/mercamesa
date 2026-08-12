/**
 * PostgREST devuelve como máximo 1.000 filas por consulta (`db-max-rows`), y lo
 * hace en silencio: no hay error ni aviso, simplemente faltan datos. En tablas
 * que ya superan ese tamaño —el catálogo de productos, por ejemplo— eso se
 * traduce en bugs difíciles de rastrear, como filas válidas rechazadas por
 * "no existe en el catálogo".
 *
 * Este helper recorre la consulta por páginas con `.range()` hasta agotarla.
 */

/** Tamaño de página. Coincide con el tope por defecto de PostgREST. */
export const DEFAULT_PAGE_SIZE = 1000;

/**
 * Ejecuta la consulta por páginas y devuelve todas las filas.
 *
 * `buildQuery` se llama una vez por página porque un query builder de
 * supabase-js no se puede reutilizar tras ejecutarlo.
 *
 * @example
 * const productos = await fetchAllRows((from, to) =>
 *   supabase.from('catalog_products').select('id, slug').eq('is_active', true).range(from, to)
 * );
 */
export async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>,
  pageSize: number = DEFAULT_PAGE_SIZE
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  // Sin tope de páginas a propósito: el corte lo da que una página vuelva
  // incompleta, que es la única señal fiable de haber llegado al final.
  for (;;) {
    const { data, error } = await buildQuery(from, from + pageSize - 1);
    if (error) throw new Error(error.message);

    const page = data ?? [];
    rows.push(...page);

    if (page.length < pageSize) return rows;
    from += pageSize;
  }
}
