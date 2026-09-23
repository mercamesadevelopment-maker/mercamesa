'use client';

import { useEffect, useMemo, useState } from 'react';
import { Users, Search, Loader2, KeyRound, LogOut, Store as StoreIcon, UserX } from 'lucide-react';
import { Button, Badge } from '@/src/components/Shared';
import { Table } from '@/components/ui/table/components/Table';
import { ConfirmModal } from '@/components/ui/confirm-modal/ConfirmModal';
import { useAdminUsers, type AdminUser } from './hooks/use-admin-users';
import { timeAgo, fechaCorta, fechaCompleta } from '@/lib/dates/relative-time';

type ActionKind = 'reset' | 'revoke' | 'anonymize';
type PendingAction = { user: AdminUser; kind: ActionKind } | null;

/**
 * Una fecha de auditoría. Muestra lo relativo, que es lo que se lee de un
 * vistazo, y deja el momento exacto en el `title` para cuando haga falta
 * precisión. Cuando no hay fecha, dice por qué no la hay en vez de un guion.
 */
function FechaAuditoria({
  etiqueta,
  valor,
  vacio,
}: {
  etiqueta: string;
  valor: string | null;
  vacio: string;
}) {
  return (
    <p className="text-mm-txs">
      <span className="text-mm-txw">{etiqueta}: </span>
      {valor ? (
        <span title={fechaCompleta(valor)}>{timeAgo(valor)}</span>
      ) : (
        <span className="text-mm-txw italic">{vacio}</span>
      )}
    </p>
  );
}

export default function AdminUsersPage() {
  const { users, loading, error, fetchUsers, sendPasswordReset, revokeSessions, anonymizeUser } =
    useAdminUsers();

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
      } else if (pending.kind === 'anonymize') {
        await anonymizeUser(pending.user.id);
        setNotice({
          title: 'Datos suprimidos',
          message:
            'Se borraron sus datos personales y su cuenta de acceso. Sus pedidos siguen ahí, ' +
            'sin nombre y con la dirección reducida a municipio y departamento.',
        });
        await fetchUsers();
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

  /**
   * Qué dice el diálogo según la acción. Extraído del JSX porque con tres
   * acciones el ternario anidado dejaba de leerse.
   */
  const CONFIRMACIONES: Record<ActionKind, {
    variant: 'danger' | 'warning' | 'info';
    title: string;
    confirmText: string;
    message: (u: AdminUser) => React.ReactNode;
  }> = {
    reset: {
      variant: 'info',
      title: 'Enviar código de recuperación',
      confirmText: 'Enviar código',
      message: (u) => (
        <>
          Le enviaremos un código de 6 dígitos a{' '}
          <span className="font-bold text-mm-g">{u.email}</span> para que él mismo
          defina su nueva contraseña.
          {'\n\n'}
          Tú no verás ni definirás la contraseña. La acción queda registrada.
        </>
      ),
    },
    revoke: {
      variant: 'danger',
      title: 'Cerrar todas sus sesiones',
      confirmText: 'Sí, cerrar sesiones',
      message: (u) => (
        <>
          Se cerrarán todas las sesiones de{' '}
          <span className="font-bold text-mm-g">{u.fullName || u.email}</span>{' '}
          y tendrá que volver a ingresar.
          {'\n\n'}
          Por sí solo esto no basta si sospechas suplantación: el acceso ya emitido puede durar
          hasta una hora, y quien tenga la contraseña puede volver a entrar. Restablece también
          su contraseña.
        </>
      ),
    },
    anonymize: {
      variant: 'danger',
      title: 'Suprimir sus datos personales',
      confirmText: 'Sí, suprimir sus datos',
      message: (u) => (
        <>
          Vas a atender una solicitud de supresión de datos de{' '}
          <span className="font-bold text-mm-g">{u.fullName || u.email}</span>.
          {'\n\n'}
          <span className="font-bold">Se borra:</span> su nombre, correo, teléfono, documento,
          foto, direcciones guardadas, métodos de pago y su cuenta de acceso. En sus pedidos, la
          dirección queda reducida a municipio y departamento.
          {'\n\n'}
          <span className="font-bold">Se conserva:</span> sus pedidos y facturas —hay deber legal
          de conservarlos ante la DIAN— y la constancia de que aceptó los términos.
          {'\n\n'}
          No se puede deshacer, y la persona no podrá volver a entrar con ese correo (sí
          registrarse de cero). Queda registrado que lo hiciste tú.
        </>
      ),
    },
  };

  const confirmacion = {
    variant: pending ? CONFIRMACIONES[pending.kind].variant : 'info' as const,
    title: pending ? CONFIRMACIONES[pending.kind].title : '',
    confirmText: pending ? CONFIRMACIONES[pending.kind].confirmText : '',
    message: pending ? CONFIRMACIONES[pending.kind].message(pending.user) : '',
  };

  const columns = [
    {
      key: 'fullName',
      label: 'Usuario',
      render: (u: AdminUser) =>
        u.anonymizedAt ? (
          // Ya no es una persona: es una fila que sostiene pedidos. Se dice así
          // en vez de mostrar el correo inventado como si fuera real.
          <div>
            <p className="font-bold text-mm-txw italic">Usuario eliminado</p>
            <p className="text-xs text-mm-txw" title={fechaCompleta(u.anonymizedAt)}>
              Datos suprimidos {timeAgo(u.anonymizedAt).toLowerCase()}
            </p>
          </div>
        ) : (
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
        <span className="text-xs text-mm-txs" title={fechaCompleta(u.createdAt)}>
          {fechaCorta(u.createdAt)}
        </span>
      ),
    },
    {
      // Las tres fechas de auditoría en una sola columna: por separado la tabla
      // quedaría con siete y en pantallas normales no cabría.
      key: 'actividad',
      label: 'Actividad',
      render: (u: AdminUser) => (
        <div className="space-y-0.5 text-xs">
          <FechaAuditoria etiqueta="Ingreso" valor={u.lastSignInAt} vacio="Nunca ha ingresado" />
          <FechaAuditoria etiqueta="Editado" valor={u.updatedAt} vacio="Sin cambios" />
          <FechaAuditoria etiqueta="Correo" valor={u.emailVerifiedAt} vacio="Sin verificar" />
        </div>
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
          actions={(u: AdminUser) =>
            // Sobre una fila ya anonimizada no hay nada que hacer: no tiene
            // cuenta a la que mandarle nada ni sesiones que cerrar.
            u.anonymizedAt ? (
              <span className="text-xs text-mm-txw italic">Sin acciones</span>
            ) : (
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
                <Button
                  variant="outline"
                  size="sm"
                  className="border-r/40 text-r hover:bg-rl"
                  onClick={() => setPending({ user: u, kind: 'anonymize' })}
                >
                  <UserX className="mr-1.5 h-3.5 w-3.5" />
                  Suprimir datos
                </Button>
              </div>
            )
          }
        />
      )}

      <ConfirmModal
        isOpen={!!pending}
        onClose={() => setPending(null)}
        onConfirm={handleConfirm}
        isLoading={working}
        variant={confirmacion.variant}
        title={confirmacion.title}
        confirmText={confirmacion.confirmText}
        message={confirmacion.message}
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
