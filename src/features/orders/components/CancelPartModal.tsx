import { useEffect, useState } from 'react';
import { AlertTriangle, MessageSquare, XCircle } from 'lucide-react';
import { Modal } from '@/components/ui/modal/modal';
import { Button } from '@/src/components/Shared';
import { fmt } from '@/src/constants';
import { MIN_CANCEL_REASON } from '@/lib/orders/cancel-part-rules';

interface CancelPartModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Lanza si no se pudo: el motivo se muestra acá y el modal no se cierra. */
  onConfirm: (reason: string) => Promise<void>;
  /** Valor de los productos de la tienda en este pedido. */
  subtotal: number;
}

/**
 * La tienda no puede cumplir su parte de un pedido de varias tiendas.
 *
 * El motivo es obligatorio porque lo lee el comprador: es lo único que sabrá de
 * por qué no le llega parte de lo que pidió.
 */
export function CancelPartModal({ isOpen, onClose, onConfirm, subtotal }: CancelPartModalProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setReason('');
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const canSubmit = reason.trim().length >= MIN_CANCEL_REASON && !isSubmitting;

  const handleConfirm = async () => {
    if (!canSubmit) return;
    try {
      setIsSubmitting(true);
      setError(null);
      await onConfirm(reason.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cancelar esta parte del pedido.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="No puedo cumplir mi parte" maxWidth="max-w-md">
      <div className="p-6 space-y-6">
        <div className="flex items-start gap-3 bg-amber-50 p-4 rounded-2xl border border-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 font-semibold leading-relaxed space-y-1.5">
            <p>
              Se cancela solo lo de tu tienda ({fmt(subtotal)}). El resto del pedido sale con las demás tiendas y al
              comprador se le devuelve el valor de tus productos como saldo a favor.
            </p>
            <p>No se puede deshacer: el inventario vuelve a tu tienda y esta venta no se te paga.</p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-wider text-mm-txw flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" /> Motivo (lo lee el comprador)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej: Se nos agotó el tomate chonto y no nos llega hasta mañana."
            className="w-full h-28 px-4 py-3 rounded-2xl border border-mm-crd bg-white focus:border-mm-g focus:ring-2 focus:ring-mm-gll outline-none text-xs font-semibold text-mm-g transition-all resize-none placeholder:text-mm-txw/70"
          />
        </div>

        {error && (
          <p className="text-xs text-red-700 font-semibold bg-red-50 border border-red-200 rounded-xl p-3">{error}</p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl px-4 h-10 border border-mm-crd text-mm-txs hover:bg-mm-gbg hover:text-mm-g transition-colors font-bold"
          >
            Volver
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleConfirm}
            disabled={!canSubmit}
            className="rounded-xl px-5 h-10 font-bold text-xs disabled:opacity-50"
          >
            <XCircle className="w-4 h-4 mr-1" />
            {isSubmitting ? 'Cancelando...' : 'Cancelar mi parte'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
