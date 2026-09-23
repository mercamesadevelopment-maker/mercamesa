'use client';

import { useCallback, useState } from 'react';
import type { RolInvitable } from '../components/InviteAdminModal';

/**
 * Las invitaciones de administrador pendientes.
 *
 * Aparte de `useAdminUsers` a propósito: una invitación todavía no es un
 * usuario —no tiene perfil, ni rol asignado, ni sesión— y mezclarlas obligaría a
 * que la tabla de usuarios supiera distinguir entre filas reales y promesas.
 */

export interface AdminInvitation {
  id: string;
  email: string;
  roleLabel: string;
  createdAt: string;
  expiresAt: string;
  invitedByName: string | null;
  expired: boolean;
}

async function handle<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Request failed');
  return json as T;
}

export function useAdminInvitations() {
  const [invitations, setInvitations] = useState<AdminInvitation[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchInvitations = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await handle<{ data: AdminInvitation[] }>(
        await fetch('/api/admin/users/invite')
      );
      setInvitations(data);
    } catch {
      // Es información secundaria de la pantalla: si no carga, la lista de
      // usuarios y sus acciones tienen que seguir funcionando igual.
      setInvitations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const inviteAdmin = useCallback(
    async (email: string, roleName: RolInvitable) => {
      await handle(
        await fetch('/api/admin/users/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, roleName }),
        })
      );
      await fetchInvitations();
    },
    [fetchInvitations]
  );

  const cancelInvitation = useCallback(
    async (inviteId: string) => {
      await handle(
        await fetch(`/api/admin/users/invite?inviteId=${inviteId}`, { method: 'DELETE' })
      );
      await fetchInvitations();
    },
    [fetchInvitations]
  );

  return { invitations, loading, fetchInvitations, inviteAdmin, cancelInvitation };
}
