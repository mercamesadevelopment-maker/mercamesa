'use client';

import { useEffect, useState } from 'react';
import { Button, Input, cn } from '@/src/components/Shared';
import { Modal } from '@/components/ui/modal/modal';
import type { StaffRole } from '@/lib/marketplace-staff/actor';

/** Los dos roles del equipo de una plaza. La lista también está cerrada en el servidor. */
const ROLES: { name: StaffRole; label: string; hint: string }[] = [
  {
    name: 'runner',
    label: 'Patinador',
    hint: 'Recoge en cada tienda las partes de un pedido de varias tiendas y las lleva a la bahía.',
  },
  {
    name: 'logistics',
    label: 'Logística',
    hint: 'Recibe los pedidos en la bahía y se los entrega al domiciliario, validando el código.',
  },
];

interface InviteMarketplaceStaffModalProps {
  isOpen: boolean;
  marketplaceName: string;
  onClose: () => void;
  onConfirm: (email: string, role: StaffRole) => Promise<{ assigned: boolean }>;
}

/**
 * Invitar a alguien al equipo de una plaza. Mismo flujo que `InviteAdminModal`:
 * solo pide correo y rol; el resto lo llena el invitado al aceptar. Si ya tiene
 * cuenta con ese rol, queda asignado a la plaza sin invitación.
 */
export function InviteMarketplaceStaffModal({
  isOpen,
  marketplaceName,
  onClose,
  onConfirm,
}: InviteMarketplaceStaffModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StaffRole>('runner');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setRole('runner');
      setError(null);
      setHecho(null);
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
      const { assigned } = await onConfirm(correo, role);
      setHecho(
        assigned
          ? `${correo} ya tenía cuenta: quedó asignado a ${marketplaceName}.`
          : `Le enviamos la invitación a ${correo}.`
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar la invitación.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Invitar al equipo de ${marketplaceName}`} maxWidth="max-w-lg">
      <div className="space-y-5 p-6">
        {hecho ? (
          <>
            <div className="rounded-2xl bg-okl px-4 py-3 text-sm font-medium text-ok">{hecho}</div>
            <div className="flex justify-end">
              <Button onClick={onClose}>Listo</Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-mm-txs">
              Le enviaremos un enlace para que defina su contraseña y complete su nombre y teléfono. La
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
                    onClick={() => setRole(r.name)}
                    className={cn(
                      'w-full rounded-2xl border px-4 py-3 text-left transition-all',
                      role === r.name ? 'border-mm-g bg-mm-gbg' : 'border-mm-crd bg-white hover:border-mm-g/40'
                    )}
                  >
                    <p className="text-sm font-bold text-mm-g">{r.label}</p>
                    <p className="text-xs text-mm-txs">{r.hint}</p>
                  </button>
                ))}
              </div>
            </div>

            {error && <div className="rounded-2xl bg-rl px-4 py-3 text-sm font-medium text-r">{error}</div>}

            <div className="flex justify-end gap-3 border-t border-mm-crd/40 pt-4">
              <Button variant="outline" onClick={onClose} disabled={working}>
                Cancelar
              </Button>
              <Button onClick={handleConfirm} loading={working} disabled={!email.trim()}>
                Enviar invitación
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
