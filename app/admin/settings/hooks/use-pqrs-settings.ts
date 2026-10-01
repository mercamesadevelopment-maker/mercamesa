'use client';

import { useCallback, useState } from 'react';

export interface PlazosPqrs {
  id: string;
  claimWindowHours: number;
  storeResponseHours: number;
  notes: string | null;
  createdAt: string;
  changedByName: string | null;
}

async function handle<T>(res: Response): Promise<T> {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? 'No se pudo completar la operación.');
  return json.data as T;
}

/** Los plazos de las PQRS y su histórico. La primera fila es la vigente. */
export function usePqrsSettings() {
  const [history, setHistory] = useState<PlazosPqrs[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setHistory(await handle<PlazosPqrs[]>(await fetch('/api/admin/pqrs-settings')));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando los plazos');
    } finally {
      setLoading(false);
    }
  }, []);

  const guardar = useCallback(
    async (valores: { claimWindowHours: number; storeResponseHours: number; notes: string }) => {
      await handle(
        await fetch('/api/admin/pqrs-settings', {
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
