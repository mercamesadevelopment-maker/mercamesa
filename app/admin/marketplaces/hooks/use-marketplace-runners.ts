'use client';

import { useCallback, useEffect, useState } from 'react';

export interface MarketplaceRunner {
  userId: string;
  name: string;
  email: string | null;
  assigned: boolean;
}

/**
 * Los patinadores de una plaza: todos los usuarios con ese rol, marcando los
 * que la atienden. Guardar manda la lista completa de asignados.
 */
export function useMarketplaceRunners(marketplaceId: string | null | undefined, enabled: boolean) {
  const [runners, setRunners] = useState<MarketplaceRunner[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const url = marketplaceId ? `/api/admin/marketplaces/${marketplaceId}/runners` : null;

  const fetchRunners = useCallback(async () => {
    if (!url || !enabled) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setRunners(json.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los patinadores.');
    } finally {
      setLoading(false);
    }
  }, [url, enabled]);

  useEffect(() => {
    fetchRunners();
  }, [fetchRunners]);

  /** Asigna o quita a un patinador y guarda de una vez. */
  const toggle = async (userId: string) => {
    if (!url) return;

    const userIds = runners
      .filter((r) => (r.userId === userId ? !r.assigned : r.assigned))
      .map((r) => r.userId);

    try {
      setSaving(true);
      setError(null);
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setRunners(json.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el cambio.');
    } finally {
      setSaving(false);
    }
  };

  return { runners, loading, saving, error, toggle };
}
