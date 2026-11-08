'use client';

import { useEffect, useState } from 'react';
import type { LogisticsReport } from '@/lib/accounting/logistics-report';
import { fetchLogisticsReport } from '../services/accounting.service';

/** El reporte de logística, que se vuelve a pedir cuando cambian los filtros. */
export function useLogisticsReport(query: string) {
  const [data, setData] = useState<LogisticsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    setLoading(true);
    setError(null);
    fetchLogisticsReport(query)
      .then((r) => vigente && setData(r))
      .catch((e: unknown) => vigente && setError(e instanceof Error ? e.message : 'No se pudo cargar la información.'))
      .finally(() => vigente && setLoading(false));
    return () => {
      vigente = false;
    };
  }, [query]);

  return { data, loading, error };
}
