'use client';

import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Button, Input, cn } from '@/src/components/Shared';
import { Modal } from '@/components/ui/modal/modal';

/** Los dos únicos roles invitables. La lista también está cerrada en el servidor. */
const ROLES = [
  { name: 'admin' as const, label: 'Administrador', hint: 'Gestiona tiendas, catálogo y pedidos.' },
  {
    name: 'superadmin' as const,
    label: 'Super administrador',
    hint: 'Además administra usuarios, parámetros y datos personales.',
  },
];

export type RolInvitable = (typeof ROLES)[number]['name'];

interface InviteAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (email: string, roleName: RolInvitable) => Promise<void>;
}

/**
 * Invitar a alguien a administrar la plataforma.
 *
 * Solo pide correo y rol: el resto —nombre, teléfono y contraseña— lo llena el
 * invitado al aceptar, porque son datos suyos y nadie más los sabe bien.
 */
export function InviteAdminModal({ isOpen, onClose, onConfirm }: InviteAdminModalProps) {
  const [email, setEmail] = useState('');
  const [roleName, setRoleName] = useState<RolInvitable>('admin');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setRoleName('admin');
      setError(null);
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    const correo = email.trim().toLowerCase();
    if (!correo.includes('@')) {
      setError('Escribe un correo válido.');
      return;
    }
    setWorking(true);
    setError(null);
    try {
      await onConfirm(correo, roleName);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar la invitación.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Invitar administrador" maxWidth="max-w-lg">
      <div className="space-y-5 p-6">
        <p className="text-sm text-mm-txs">
          Le enviaremos un enlace para que defina su contraseña y complete su perfil. La
          invitación vence en 7 días.
        </p>

        <Input
          label="Correo electrónico"
          type="email"
          value={email}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
          placeholder="nombre@correo.com"
          autoFocus
        />

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-mm-txw">Rol</label>
          <div className="space-y-2">
            {ROLES.map((r) => (
              <button
                key={r.name}
                type="button"
                onClick={() => setRoleName(r.name)}
                className={cn(
                  'w-full rounded-2xl border px-4 py-3 text-left transition-all',
                  roleName === r.name
                    ? 'border-mm-g bg-mm-gbg'
                    : 'border-mm-crd bg-white hover:border-mm-g/40'
                )}
              >
                <p className="text-sm font-bold text-mm-g">{r.label}</p>
                <p className="text-xs text-mm-txs">{r.hint}</p>
              </button>
            ))}
          </div>
        </div>

        {roleName === 'superadmin' && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-xs leading-relaxed text-amber-900">
              Un super administrador puede suprimir datos personales, inactivar cuentas e
              invitar a otros super administradores. No se le puede inactivar desde acá.
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl bg-rl px-4 py-3 text-sm font-medium text-r">{error}</div>
        )}

        <div className="flex justify-end gap-3 border-t border-mm-crd/40 pt-4">
          <Button variant="outline" onClick={onClose} disabled={working}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} loading={working} disabled={!email.trim()}>
            Enviar invitación
          </Button>
        </div>
      </div>
    </Modal>
  );
}
