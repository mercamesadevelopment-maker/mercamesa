'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Page } from '@/lib/accounting/types';

/** Un listado de Contabilidad que se vuelve a pedir cada vez que cambian los filtros o la página. */
export function useAccountingList<T, Totals>(
  load: (query: string) => Promise<Page<T, Totals>>,
  query: string
) {
  const [data, setData] = useState<Page<T, Totals> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await load(query));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la información.');
    } finally {
      setLoading(false);
    }
  }, [load, query]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
