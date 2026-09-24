'use client';

import { useCallback, useState } from 'react';
import type { PeriodoInactivacion } from '@/lib/auth/deactivation';

/** La inactivación vigente de una cuenta. Nula si puede entrar. */
export interface Inactivacion {
  reason: string;
  period: string;
  /** Nulo = para siempre. */
  until: string | null;
  createdAt: string;
  actorName: string | null;
}

export interface AdminUser {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  createdAt: string | null;
  /** Se actualiza sola: hay un disparador BEFORE UPDATE sobre `profiles`. */
  updatedAt: string | null;
  /** De `auth.users`, no de `profiles`. Nulo si nunca ha ingresado. */
  lastSignInAt: string | null;
  /** De `auth.users`. Nulo si el correo sigue sin confirmar. */
  emailVerifiedAt: string | null;
  /** Cuándo se suprimieron sus datos. La fila existe solo para sostener pedidos. */
  anonymizedAt: string | null;
  isActive: boolean;
  deactivation: Inactivacion | null;
  role: { id: string; name: string; label: string } | null;
  stores: { id: string; name: string }[];
}

async function handle<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Request failed');
  return json as T;
}

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async (search?: string, roleId?: string) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (roleId) params.set('role_id', roleId);
      const qs = params.toString();
      const { data } = await handle<{ data: AdminUser[] }>(
        await fetch(`/api/admin/users${qs ? `?${qs}` : ''}`)
      );
      setUsers(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando los usuarios');
    } finally {
      setLoading(false);
    }
  }, []);

  const sendPasswordReset = useCallback(async (userId: string) => {
    const { message } = await handle<{ message: string }>(
      await fetch(`/api/admin/users/${userId}/reset-password`, { method: 'POST' })
    );
    return message;
  }, []);

  const revokeSessions = useCallback(async (userId: string) => {
    const { revoked } = await handle<{ revoked: number }>(
      await fetch(`/api/admin/users/${userId}/revoke-sessions`, { method: 'POST' })
    );
    return revoked;
  }, []);

  const anonymizeUser = useCallback(async (userId: string) => {
    await handle(
      await fetch(`/api/admin/users/${userId}/anonymize`, { method: 'POST' })
    );
  }, []);

  const deactivateUser = useCallback(
    async (userId: string, reason: string, period: PeriodoInactivacion) => {
      await handle(
        await fetch(`/api/admin/users/${userId}/deactivate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason, period }),
        })
      );
    },
    []
  );

  const reactivateUser = useCallback(async (userId: string) => {
    await handle(
      await fetch(`/api/admin/users/${userId}/reactivate`, { method: 'POST' })
    );
  }, []);

  return {
    users,
    loading,
    error,
    fetchUsers,
    sendPasswordReset,
    revokeSessions,
    anonymizeUser,
    deactivateUser,
    reactivateUser,
  };
}
