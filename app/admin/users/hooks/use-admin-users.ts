'use client';

import { useCallback, useState } from 'react';

export interface AdminUser {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  createdAt: string | null;
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

  return { users, loading, error, fetchUsers, sendPasswordReset, revokeSessions };
}
