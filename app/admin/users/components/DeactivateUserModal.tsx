'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button, cn } from '@/src/components/Shared';
import { Modal } from '@/components/ui/modal/modal';
import { PERIODOS, ETIQUETA_PERIODO, type PeriodoInactivacion } from '@/lib/auth/deactivation';
import type { AdminUser } from '../hooks/use-admin-users';

interface DeactivateUserModalProps {
  user: AdminUser | null;
  onClose: () => void;
  onConfirm: (reason: string, period: PeriodoInactivacion) => Promise<void>;
}

/**
 * Inactivar pide dos datos, así que no cabe en un `ConfirmModal` —que solo
 * muestra un mensaje y cobra un sí o un no— y va sobre el `Modal` genérico.
 *
 * El motivo es obligatorio también acá, y no solo en el servidor: es el dato por
 * el que después se pregunta, y dejarlo opcional garantiza que la mitad de las
 * filas queden sin él.
 */
export function DeactivateUserModal({ user, onClose, onConfirm }: DeactivateUserModalProps) {
  const [reason, setReason] = useState('');
  const [period, setPeriod] = useState<PeriodoInactivacion>('15d');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Se limpia al abrir y no al cerrar: si el envío falla, lo escrito sigue ahí
  // para corregirlo en vez de tener que volver a redactarlo.
  useEffect(() => {
    if (user) {
      setReason('');
      setPeriod('15d');
      setError(null);
    }
  }, [user]);

  const handleConfirm = async () => {
    if (!reason.trim()) {
      setError('Escribe el motivo de la inactivación.');
      return;
    }
    setWorking(true);
    setError(null);
    try {
      await onConfirm(reason.trim(), period);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo inactivar la cuenta.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <Modal
      isOpen={!!user}
      onClose={onClose}
      title="Inactivar cuenta"
      maxWidth="max-w-lg"
    >
      <div className="space-y-5 p-6">
        <p className="text-sm text-mm-txs">
          Vas a quitarle el acceso a{' '}
          <span className="font-bold text-mm-g">{user?.fullName || user?.email}</span>. Se
          le cerrarán todas sus sesiones y no podrá volver a entrar hasta que termine el
          periodo o lo reactives.
        </p>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-mm-txw">
            Motivo
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            autoFocus
            placeholder="Por qué se inactiva esta cuenta..."
            className="w-full resize-none rounded-2xl border border-mm-crd bg-white px-4 py-3 text-sm text-mm-g outline-none transition-all focus:border-mm-g"
          />
          <p className="text-xs text-mm-txw">
            Queda registrado junto con tu nombre. El usuario no lo ve.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-mm-txw">
            Por cuánto tiempo
          </label>
          <div className="grid grid-cols-2 gap-2">
            {PERIODOS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={cn(
                  'rounded-2xl border px-4 py-3 text-sm font-bold transition-all',
                  period === p
                    ? 'border-mm-g bg-mm-gbg text-mm-g'
                    : 'border-mm-crd bg-white text-mm-txs hover:border-mm-g/40'
                )}
              >
                {ETIQUETA_PERIODO[p]}
              </button>
            ))}
          </div>
        </div>

        {period === 'forever' && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-xs leading-relaxed text-amber-900">
              Sin fecha de vencimiento, la cuenta solo vuelve si alguien la reactiva a
              mano.
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
          <Button
            onClick={handleConfirm}
            loading={working}
            disabled={!reason.trim()}
            className="border-r/40 bg-r text-white hover:bg-r/90"
          >
            Inactivar cuenta
          </Button>
        </div>
      </div>
    </Modal>
  );
}
