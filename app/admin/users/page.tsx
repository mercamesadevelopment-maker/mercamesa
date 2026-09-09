'use client';

import { useEffect, useMemo, useState } from 'react';
import { Users, Search, Loader2, KeyRound, LogOut, Store as StoreIcon } from 'lucide-react';
import { Button, Badge } from '@/src/components/Shared';
import { Table } from '@/components/ui/table/components/Table';
import { ConfirmModal } from '@/components/ui/confirm-modal/ConfirmModal';
import { useAdminUsers, type AdminUser } from './hooks/use-admin-users';

type PendingAction = { user: AdminUser; kind: 'reset' | 'revoke' } | null;

export default function AdminUsersPage() {
  const { users, loading, error, fetchUsers, sendPasswordReset, revokeSessions } = useAdminUsers();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [pending, setPending] = useState<PendingAction>(null);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El buscador y el filtro se aplican en memoria: son 21 usuarios hoy y no
  // vale la pena un viaje al servidor por cada tecla.
  const roles = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => { if (u.role) map.set(u.role.id, u.role.label); });
    return Array.from(map, ([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [users]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter && u.role?.id !== roleFilter) return false;
      if (!term) return true;
      return (
        (u.fullName || '').toLowerCase().includes(term) ||
        (u.email || '').toLowerCase().includes(term)
      );
    });
  }, [users, search, roleFilter]);

  const handleConfirm = async () => {
    if (!pending) return;
    setWorking(true);
    try {
      if (pending.kind === 'reset') {
        const message = await sendPasswordReset(pending.user.id);
        setNotice({ title: 'Código enviado', message });
      } else {
        const revoked = await revokeSessions(pending.user.id);
        setNotice({
          title: 'Sesiones cerradas',
          message:
            revoked > 0
              ? `Se cerraron ${revoked} ${revoked === 1 ? 'sesión' : 'sesiones'}. Ten en cuenta que el acceso ya emitido puede seguir activo hasta una hora, así que restablece también su contraseña.`
              : 'El usuario no tenía sesiones abiertas.',
        });
      }
      setPending(null);
    } catch (e: unknown) {
      setNotice({
        title: 'No se pudo completar',
        message: e instanceof Error ? e.message : 'Error inesperado',
      });
      setPending(null);
    } finally {
      setWorking(false);
    }
  };

  const columns = [
    {
      key: 'fullName',
      label: 'Usuario',
      render: (u: AdminUser) => (
        <div>
          <p className="font-bold text-mm-g">{u.fullName || 'Sin nombre'}</p>
          <p className="text-xs text-mm-txw">{u.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Rol',
      render: (u: AdminUser) =>
        u.role ? <Badge>{u.role.label}</Badge> : <span className="text-xs text-mm-txw">Sin rol</span>,
    },
    {
      key: 'stores',
      label: 'Tiendas',
      render: (u: AdminUser) =>
        u.stores.length === 0 ? (
          <span className="text-xs text-mm-txw">—</span>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-mm-txs">
            <StoreIcon className="h-3.5 w-3.5 text-mm-txw" />
            {u.stores.map((s) => s.name).join(', ')}
          </div>
        ),
    },
    {
      key: 'createdAt',
      label: 'Registro',
      render: (u: AdminUser) => (
        <span className="text-xs text-mm-txs">
          {u.createdAt ? new Date(u.createdAt).toLocaleDateString('es-CO') : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mm-gbg text-mm-g">
          <Users className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-fraunces text-mm-g">Usuarios</h1>
          <p className="text-sm text-mm-txs">
            Todos los usuarios de la plataforma, sin importar su rol.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-rl px-4 py-3 text-sm font-medium text-r">{error}</div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-grow">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-mm-txw" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o correo..."
            className="w-full rounded-2xl border border-mm-crd bg-white py-3 pl-12 pr-4 text-sm outline-none transition-all focus:border-mm-g"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="cursor-pointer rounded-2xl border border-mm-crd bg-white px-4 py-3 text-sm text-mm-g outline-none transition-all focus:border-mm-g"
        >
          <option value="">Todos los roles</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-mm-txw" />
        </div>
      ) : (
        <Table<AdminUser>
          data={filtered}
          columns={columns}
          getRowKey={(u) => u.id}
          emptyMessage="No se encontraron usuarios."
          actions={(u: AdminUser) => (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPending({ user: u, kind: 'reset' })}
              >
                <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                Restablecer clave
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPending({ user: u, kind: 'revoke' })}
              >
                <LogOut className="mr-1.5 h-3.5 w-3.5" />
                Cerrar sesiones
              </Button>
            </div>
          )}
        />
      )}

      <ConfirmModal
        isOpen={!!pending}
        onClose={() => setPending(null)}
        onConfirm={handleConfirm}
        isLoading={working}
        variant={pending?.kind === 'revoke' ? 'danger' : 'info'}
        title={
          pending?.kind === 'revoke' ? 'Cerrar todas sus sesiones' : 'Enviar código de recuperación'
        }
        confirmText={pending?.kind === 'revoke' ? 'Sí, cerrar sesiones' : 'Enviar código'}
        message={
          pending?.kind === 'revoke' ? (
            <>
              Se cerrarán todas las sesiones de{' '}
              <span className="font-bold text-mm-g">{pending?.user.fullName || pending?.user.email}</span>{' '}
              y tendrá que volver a ingresar.
              {'\n\n'}
              Por sí solo esto no basta si sospechas suplantación: el acceso ya emitido puede durar
              hasta una hora, y quien tenga la contraseña puede volver a entrar. Restablece también
              su contraseña.
            </>
          ) : (
            <>
              Le enviaremos un código de 6 dígitos a{' '}
              <span className="font-bold text-mm-g">{pending?.user.email}</span> para que él mismo
              defina su nueva contraseña.
              {'\n\n'}
              Tú no verás ni definirás la contraseña. La acción queda registrada.
            </>
          )
        }
      />

      <ConfirmModal
        isOpen={!!notice}
        onClose={() => setNotice(null)}
        onConfirm={() => setNotice(null)}
        variant="info"
        hideCancel
        confirmText="Entendido"
        title={notice?.title || ''}
        message={notice?.message || ''}
      />
    </div>
  );
}
