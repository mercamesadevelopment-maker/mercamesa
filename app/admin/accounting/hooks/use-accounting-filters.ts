'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export type AccountingTab = 'payments' | 'credit-notes' | 'payouts' | 'refunds';
const TABS: AccountingTab[] = ['payments', 'credit-notes', 'payouts', 'refunds'];
export const PAGE_SIZES = [25, 50, 100];

export interface AccountingFilterValues {
  buyer: string;
  storeId: string;
  marketplaceId: string;
  year: string;
  month: string;
}

const FILTER_PARAMS: Record<keyof AccountingFilterValues, string> = {
  buyer: 'buyer',
  storeId: 'store_id',
  marketplaceId: 'marketplace_id',
  year: 'year',
  month: 'month',
};

/**
 * La pestaña y los filtros viven en la URL: un enlace se puede compartir y la
 * vista sobrevive a una recarga. `query` es lo que se le pasa tal cual a la API.
 */
export function useAccountingFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const tabParam = params.get('tab') as AccountingTab | null;
  const tab: AccountingTab = tabParam && TABS.includes(tabParam) ? tabParam : 'payments';

  const values: AccountingFilterValues = useMemo(
    () => ({
      buyer: params.get('buyer') ?? '',
      storeId: params.get('store_id') ?? '',
      marketplaceId: params.get('marketplace_id') ?? '',
      year: params.get('year') ?? '',
      month: params.get('month') ?? '',
    }),
    [params]
  );

  const page = Math.max(1, Number(params.get('page')) || 1);
  const pageSize = PAGE_SIZES.includes(Number(params.get('page_size'))) ? Number(params.get('page_size')) : 50;

  const replace = useCallback(
    (cambios: Record<string, string>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(cambios)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router]
  );

  /**
   * Cambiar filtros vuelve a la primera página. Varios a la vez van en una sola
   * llamada: dos seguidas partirían de la misma URL y la segunda pisaría la primera.
   */
  const setFilters = useCallback(
    (changes: Partial<AccountingFilterValues>) => {
      const cambios: Record<string, string> = { page: '' };
      for (const [key, value] of Object.entries(changes)) {
        cambios[FILTER_PARAMS[key as keyof AccountingFilterValues]] = value ?? '';
      }
      // Un mes sin año no filtra: al quitar el año se quita el mes.
      if ('year' in changes && !changes.year) cambios.month = '';
      replace(cambios);
    },
    [replace]
  );

  const clearFilters = useCallback(
    () => replace(Object.fromEntries([...Object.values(FILTER_PARAMS), 'page'].map((k) => [k, '']))),
    [replace]
  );

  const query = useMemo(() => {
    const q = new URLSearchParams();
    for (const [key, param] of Object.entries(FILTER_PARAMS)) {
      const v = values[key as keyof AccountingFilterValues];
      if (v) q.set(param, v);
    }
    return q;
  }, [values]);

  return {
    tab,
    setTab: (t: AccountingTab) => replace({ tab: t, page: '' }),
    values,
    setFilters,
    clearFilters,
    hasFilters: query.toString() !== '',
    page,
    setPage: (p: number) => replace({ page: p > 1 ? String(p) : '' }),
    pageSize,
    setPageSize: (n: number) => replace({ page_size: n === 50 ? '' : String(n), page: '' }),
    /** Solo los filtros, para la API (`?buyer=…`). */
    filterQuery: query.toString() ? `?${query.toString()}` : '',
    /** Filtros y página. */
    pagedQuery: (() => {
      const q = new URLSearchParams(query);
      if (page > 1) q.set('page', String(page));
      if (pageSize !== 50) q.set('page_size', String(pageSize));
      return q.toString() ? `?${q.toString()}` : '';
    })(),
  };
}
