'use client';

import { useCallback, useState } from 'react';
import type { Payout, PayoutDetalle, Elegibles } from '../types';

async function handle<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Request failed');
  return json as T;
}

/**
 * Las liquidaciones.
 *
 * `descargar` no usa `window.open`: la ruta del archivo comprueba el permiso y
 * devuelve el contenido, no una URL. Se trae con `fetch` y se dispara la
 * descarga desde el blob, así el archivo nunca queda en una URL que alguien
 * pueda reenviar.
 */
export function usePayouts() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPayouts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await handle<{ data: Payout[] }>(await fetch('/api/admin/payouts'));
      setPayouts(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando las liquidaciones');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchElegibles = useCallback(async (): Promise<Elegibles> => {
    const { data } = await handle<{ data: Elegibles }>(
      await fetch('/api/admin/payouts/eligible')
    );
    return data;
  }, []);

  const fetchDetalle = useCallback(async (id: string): Promise<PayoutDetalle> => {
    const { data } = await handle<{ data: PayoutDetalle }>(
      await fetch(`/api/admin/payouts/${id}`)
    );
    return data;
  }, []);

  const crearBorrador = useCallback(async () => {
    const r = await handle<{ itemsCount: number; storesCount: number; totalAmount: number }>(
      await fetch('/api/admin/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
    );
    await fetchPayouts();
    return r;
  }, [fetchPayouts]);

  const aprobar = useCallback(
    async (id: string) => {
      const r = await handle<{ fileName: string; storesCount: number; totalAmount: number }>(
        await fetch(`/api/admin/payouts/${id}/approve`, { method: 'POST' })
      );
      await fetchPayouts();
      return r;
    },
    [fetchPayouts]
  );

  const cancelar = useCallback(
    async (id: string, notes?: string) => {
      await handle(
        await fetch(`/api/admin/payouts/${id}/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes }),
        })
      );
      await fetchPayouts();
    },
    [fetchPayouts]
  );

  const descargar = useCallback(async (id: string, fileName: string) => {
    const res = await fetch(`/api/admin/payouts/${id}/file`);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error ?? 'No se pudo descargar el archivo');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return {
    payouts,
    loading,
    error,
    fetchPayouts,
    fetchElegibles,
    fetchDetalle,
    crearBorrador,
    aprobar,
    cancelar,
    descargar,
  };
}
