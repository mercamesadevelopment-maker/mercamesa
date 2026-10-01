'use client';

import { useCallback, useEffect, useState } from 'react';
import { pqrsService } from '../services/pqrs.service';
import type { PqrsPage } from '@/lib/pqrs/queries';
import type { PqrsStatus, PqrsViewer } from '@/lib/pqrs/types';

const VACIA: PqrsPage = { items: [], total: 0, page: 1, totalPages: 1 };

/**
 * El listado de PQRS de un puesto.
 *
 * `enabled` existe para el tendero: su listado depende de la tienda activa, que
 * se resuelve después del primer render.
 */
export function usePqrsList(scope: PqrsViewer, storeId?: string | null, enabled = true) {
  const [data, setData] = useState<PqrsPage>(VACIA);
  const [status, setStatusState] = useState<PqrsStatus | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    if (!enabled) return;
    try {
      setLoading(true);
      setError(null);
      setData(await pqrsService.list({ scope, status, storeId, page }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las PQRS.');
    } finally {
      setLoading(false);
    }
  }, [scope, status, storeId, page, enabled]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Cambiar el filtro vuelve a la primera página: la 3 de «todas» puede no
  // existir en «resueltas».
  const setStatus = useCallback((next: PqrsStatus | null) => {
    setStatusState(next);
    setPage(1);
  }, []);

  return { data, status, setStatus, page, setPage, loading, error, refresh: fetchList };
}
