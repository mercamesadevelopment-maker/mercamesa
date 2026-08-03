import { useState, useCallback, useEffect } from 'react';
import { OrderMinPriceHistoryRow } from '../types/settings.types';
import { getOrderMinPriceHistoryService, addOrderMinPriceAdjustmentService } from '../services/settings.service';

export function useOrderMinPrice() {
  const [history, setHistory] = useState<OrderMinPriceHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getOrderMinPriceHistoryService();
      setHistory(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar el histórico de precio mínimo');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const addAdjustment = async (minPrice: number, notes: string) => {
    try {
      await addOrderMinPriceAdjustmentService({ min_price: minPrice, notes });
      await fetchHistory();
    } catch (err: unknown) {
      throw new Error(err instanceof Error ? err.message : 'Error al registrar el ajuste');
    }
  };

  const currentMinPrice = history[0]?.min_price ?? 0;
  const currentAdjustment = history[0] ?? null;

  return {
    history,
    currentMinPrice,
    currentAdjustment,
    loading,
    error,
    fetchHistory,
    addAdjustment,
  };
}
