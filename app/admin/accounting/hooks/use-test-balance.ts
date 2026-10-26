'use client';

import { useCallback, useEffect, useState } from 'react';
import type { BalanceReport } from '@/lib/accounting/test-balance';
import { BalanceError, fetchBalanceReports, generateBalanceService } from '../services/accounting.service';

/** El historial de balances y generar uno nuevo. */
export function useTestBalance() {
  const [reports, setReports] = useState<BalanceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<{ message: string; notConfigured: boolean } | null>(null);

  useEffect(() => {
    fetchBalanceReports()
      .then(setReports)
      .catch((e) => setError({ message: e instanceof Error ? e.message : 'No se pudo cargar el historial.', notConfigured: false }))
      .finally(() => setLoading(false));
  }, []);

  const generate = useCallback(async (body: Record<string, unknown>): Promise<BalanceReport | null> => {
    setGenerating(true);
    setError(null);
    try {
      const report = await generateBalanceService(body);
      setReports((prev) => [report, ...prev]);
      return report;
    } catch (e) {
      setError({
        message: e instanceof Error ? e.message : 'No se pudo generar el balance.',
        notConfigured: e instanceof BalanceError && e.code === 'siigo_not_configured',
      });
      return null;
    } finally {
      setGenerating(false);
    }
  }, []);

  return { reports, loading, generating, error, generate };
}
