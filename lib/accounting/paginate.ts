import type { Page } from './types';

export const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export function pageParams(params: URLSearchParams): { page: number; pageSize: number } {
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);
  const size = Number.parseInt(params.get('page_size') ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE;
  return { page, pageSize: Math.min(Math.max(1, size), MAX_PAGE_SIZE) };
}

/**
 * Corta una página de filas ya filtradas y ordenadas. Los totales se calculan
 * sobre todas, no sobre la página: son los del filtro.
 */
export function paginate<T, Totals>(
  rows: T[],
  totals: Totals,
  { page, pageSize }: { page: number; pageSize: number }
): Page<T, Totals> {
  const start = (page - 1) * pageSize;
  return { rows: rows.slice(start, start + pageSize), totals, total: rows.length, page, pageSize };
}

export function byDateDesc<T extends { createdAt: string }>(a: T, b: T): number {
  return b.createdAt.localeCompare(a.createdAt);
}
