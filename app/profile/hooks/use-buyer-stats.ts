'use client';

import { useCallback, useEffect, useState } from 'react';
import { buyerStatsService, type BuyerStats } from '../services/buyer-stats.service';

/**
 * Las cifras del tablero, desde la base.
 *
 * Arranca en `null` y no en ceros a propósito: un cero es una afirmación —"no
 * tienes pedidos"— y mientras no se sepa, no hay que afirmar nada. La pantalla
 * muestra un guion hasta que llegue la respuesta.
 */
export function useBuyerStats() {
  const [stats, setStats] = useState<BuyerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setStats(await buyerStatsService.get());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar tus estadísticas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  return { stats, loading, error, refresh: fetchStats };
}
