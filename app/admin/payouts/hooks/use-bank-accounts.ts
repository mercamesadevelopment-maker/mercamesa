'use client';

import { useCallback, useState } from 'react';
import type { CuentaBancaria, Banco, ParametrosDispersion } from '../types';

async function handle<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Request failed');
  return json as T;
}

/** Las cuentas por verificar, y las tiendas que todavía no registraron ninguna. */
export function useBankAccounts() {
  const [accounts, setAccounts] = useState<CuentaBancaria[]>([]);
  const [sinCuenta, setSinCuenta] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await handle<{
        data: { accounts: CuentaBancaria[]; storesWithoutAccount: { id: string; name: string }[] };
      }>(await fetch('/api/admin/bank-accounts'));

      // Las pendientes primero: son las únicas que piden una acción.
      const orden = { pending: 0, rejected: 1, verified: 2 } as const;
      setAccounts(
        [...data.accounts].sort(
          (a, b) => orden[a.status] - orden[b.status] || a.storeName.localeCompare(b.storeName, 'es')
        )
      );
      setSinCuenta(data.storesWithoutAccount);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando las cuentas');
    } finally {
      setLoading(false);
    }
  }, []);

  const verificar = useCallback(
    async (id: string, aprobar: boolean, motivo?: string) => {
      await handle(
        await fetch(`/api/admin/bank-accounts/${id}/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approve: aprobar, reason: motivo }),
        })
      );
      await fetchAccounts();
    },
    [fetchAccounts]
  );

  return { accounts, sinCuenta, loading, error, fetchAccounts, verificar };
}

/** El catálogo de bancos. Solo viene BBVA; el resto los carga el superadmin. */
export function useBanks() {
  const [banks, setBanks] = useState<Banco[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchBanks = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await handle<{ data: Banco[] }>(await fetch('/api/admin/banks'));
      setBanks(data);
    } catch {
      setBanks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const crearBanco = useCallback(
    async (code: string, name: string) => {
      await handle(
        await fetch('/api/admin/banks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, name }),
        })
      );
      await fetchBanks();
    },
    [fetchBanks]
  );

  return { banks, loading, fetchBanks, crearBanco };
}

/** Los datos del ordenante, con su histórico. La fila más reciente es la vigente. */
export function usePayoutSettings() {
  const [history, setHistory] = useState<ParametrosDispersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await handle<{ data: ParametrosDispersion[] }>(
        await fetch('/api/admin/payout-settings')
      );
      setHistory(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando los parámetros');
    } finally {
      setLoading(false);
    }
  }, []);

  const guardar = useCallback(
    async (valores: Partial<ParametrosDispersion>) => {
      await handle(
        await fetch('/api/admin/payout-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(valores),
        })
      );
      await fetchSettings();
    },
    [fetchSettings]
  );

  return { history, vigente: history[0] ?? null, loading, error, fetchSettings, guardar };
}
