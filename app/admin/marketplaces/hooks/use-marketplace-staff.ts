'use client';

import { useCallback, useEffect, useState } from 'react';
import type { MarketplaceStaffOverview, MarketplaceStaffSettings } from '@/lib/marketplace-staff/admin';
import type { StaffRole } from '@/lib/marketplace-staff/actor';

async function leer(res: Response): Promise<any> {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? 'No pudimos completar la operación.');
  return json;
}

/**
 * El equipo de una plaza y cómo opera. Cada acción devuelve el equipo como
 * quedó en el servidor y se reemplaza entero.
 */
export function useMarketplaceStaff(marketplaceId: string | null | undefined, enabled: boolean) {
  const [overview, setOverview] = useState<MarketplaceStaffOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = marketplaceId ? `/api/admin/marketplaces/${marketplaceId}/staff` : null;

  const fetchStaff = useCallback(async () => {
    if (!base || !enabled) return;
    try {
      setLoading(true);
      setError(null);
      setOverview((await leer(await fetch(base))).data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el equipo de la plaza.');
    } finally {
      setLoading(false);
    }
  }, [base, enabled]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const guardar = async (body: unknown) => {
    if (!base) return;
    try {
      setSaving(true);
      setError(null);
      const json = await leer(
        await fetch(base, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      );
      setOverview(json.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = (settings: MarketplaceStaffSettings) => guardar({ settings });

  const setMemberActive = (userId: string, role: StaffRole, isActive: boolean) =>
    guardar({ member: { userId, role, isActive } });

  /** Lanza si no se pudo, para que el modal muestre el motivo. */
  const invite = async (email: string, role: StaffRole): Promise<{ assigned: boolean }> => {
    if (!base) throw new Error('Falta la plaza.');
    const json = await leer(
      await fetch(`${base}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      })
    );
    await fetchStaff();
    return json.data;
  };

  const cancelInvitation = async (inviteId: string) => {
    if (!base) return;
    try {
      setSaving(true);
      setError(null);
      await leer(await fetch(`${base}/invite?inviteId=${encodeURIComponent(inviteId)}`, { method: 'DELETE' }));
      await fetchStaff();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo cancelar la invitación.');
    } finally {
      setSaving(false);
    }
  };

  return { overview, loading, saving, error, saveSettings, setMemberActive, invite, cancelInvitation };
}
