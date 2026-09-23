import { useEffect, useState } from 'react';
import { AlertTriangle, MessageSquare, Undo2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal/modal';
import { Button, cn } from '@/src/components/Shared';
import { OrderStatus } from '@/src/types';
import { getStatusConfig } from '../utils/order-status';

// Estados en los que el mensajero ya pudo haberse solicitado a Pibox.
const DELIVERY_REQUESTED: OrderStatus[] = ['at_collection', 'dispatched', 'delivered'];
// Estados que tienen el stock descontado (espejo de fn_process_store_order_status_change).
const STOCK_DEDUCTED: OrderStatus[] = ['confirmed', 'paid', 'packing', 'at_collection', 'dispatched', 'delivered'];

interface RevertStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (targetStatus: OrderStatus, notes: string) => Promise<void>;
  currentStatus: OrderStatus | null;
  /** Estados permitidos, ya calculados con `getRevertTargets`. */
  targets: OrderStatus[];
}

/**
 * Regresa un pedido a un estado anterior, para casos extremos. La observación es
 * obligatoria porque queda en el historial de auditoría y la ve el comprador.
 */
export function RevertStatusModal({
  isOpen,
  onClose,
  onConfirm,
  currentStatus,
  targets,
}: RevertStatusModalProps) {
  const [target, setTarget] = useState<OrderStatus | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setTarget(null);
      setNotes('');
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const canSubmit = !!target && notes.trim().length > 0 && !isSubmitting;

  const handleConfirm = async () => {
    if (!canSubmit || !target) return;
    try {
      setIsSubmitting(true);
      setError(null);
      await onConfirm(target, notes.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo regresar el estado del pedido.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const warnings: string[] = [];
  if (target && currentStatus) {
    if (DELIVERY_REQUESTED.includes(currentStatus) && !DELIVERY_REQUESTED.includes(target)) {
      warnings.push('Si ya se solicitó un domicilio en Pibox, cancélalo manualmente allá.');
    }
    const wasDeducted = STOCK_DEDUCTED.includes(currentStatus);
    const willDeduct = STOCK_DEDUCTED.includes(target);
    if (wasDeducted && !willDeduct) {
      warnings.push('El inventario de los productos se devolverá automáticamente.');
    } else if (!wasDeducted && willDeduct) {
      warnings.push('El inventario de los productos se descontará de nuevo automáticamente.');
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Regresar a un estado anterior" maxWidth="max-w-md">
      <div className="p-6 space-y-6">
        <div className="flex items-start gap-3 bg-amber-50 p-4 rounded-2xl border border-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900 font-semibold leading-relaxed">
            Úsalo solo para corregir errores. El cambio quedará registrado con tu nombre y la
            observación será visible para el comprador.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-wider text-mm-txw">
            Regresar a
          </p>
          <div className="grid grid-cols-2 gap-2">
            {targets.map((s) => {
              const conf = getStatusConfig(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setTarget(s)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all text-left',
                    target === s
                      ? 'border-mm-g bg-mm-gbg text-mm-g ring-2 ring-mm-g/20'
                      : 'border-mm-crd bg-white text-mm-txs hover:border-mm-g/40'
                  )}
                >
                  <conf.icon className="w-4 h-4 flex-shrink-0" />
                  {conf.label}
                </button>
              );
            })}
          </div>
        </div>

        {warnings.length > 0 && (
          <ul className="space-y-1.5 text-[11px] text-mm-txs font-semibold list-disc pl-5">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-wider text-mm-txw flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" /> Observación (obligatoria)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej: Se marcó como entregado por error, el mensajero aún no llega donde el cliente."
            className="w-full h-28 px-4 py-3 rounded-2xl border border-mm-crd bg-white focus:border-mm-g focus:ring-2 focus:ring-mm-gll outline-none text-xs font-semibold text-mm-g transition-all resize-none placeholder:text-mm-txw/70"
          />
        </div>

        {error && (
          <p className="text-xs text-red-700 font-semibold bg-red-50 border border-red-200 rounded-xl p-3">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl px-4 h-10 border border-mm-crd text-mm-txs hover:bg-mm-gbg hover:text-mm-g transition-colors font-bold"
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleConfirm}
            disabled={!canSubmit}
            className="rounded-xl px-5 h-10 bg-amber-600 text-white hover:bg-amber-700 font-bold text-xs disabled:opacity-50"
          >
            <Undo2 className="w-4 h-4 mr-1" />
            {isSubmitting ? 'Guardando...' : 'Regresar estado'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
