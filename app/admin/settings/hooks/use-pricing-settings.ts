import { useState, useCallback, useEffect } from 'react';
import { PricingSettingsRow, PricingSettingsInsert, EnsureSiigoProductResult } from '../types/settings.types';
import {
  getPricingSettingsService,
  addPricingSettingsService,
  ensureSiigoServiceProductsService,
} from '../services/settings.service';

export function usePricingSettings() {
  const [history, setHistory] = useState<PricingSettingsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPricingSettingsService();
      setHistory(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar las tarifas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const addAdjustment = async (payload: PricingSettingsInsert) => {
    try {
      await addPricingSettingsService(payload);
      await fetchHistory();
    } catch (err: unknown) {
      throw new Error(err instanceof Error ? err.message : 'Error al registrar el ajuste');
    }
  };

  const ensureSiigoProducts = async (): Promise<EnsureSiigoProductResult[]> => {
    const { results } = await ensureSiigoServiceProductsService();
    return results;
  };

  // La fila más reciente es la que aplica; el resto es histórico auditable.
  const current = history[0] ?? null;

  return { history, current, loading, error, fetchHistory, addAdjustment, ensureSiigoProducts };
}
