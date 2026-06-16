import React, { useState } from 'react';
import { Modal } from '@/components/ui/modal/modal';
import { Button } from '@/src/components/Shared';
import { ClipboardList, MessageSquare } from 'lucide-react';

interface StatusNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (notes: string) => void;
  title: string;
  actionLabel: string;
  nextStatusLabel: string;
}

export function StatusNoteModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  actionLabel,
  nextStatusLabel,
}: StatusNoteModalProps) {
  const [notes, setNotes] = useState('');

  const handleConfirm = () => {
    onConfirm(notes);
    setNotes('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth="max-w-md"
    >
      <div className="p-6 space-y-6">
        <div className="flex items-start gap-3 bg-slate-50 p-4 rounded-2xl border border-mm-crd/50">
          <div className="w-8 h-8 rounded-lg bg-mm-gbg flex items-center justify-center text-mm-g flex-shrink-0">
            <ClipboardList className="w-4.5 h-4.5" />
          </div>
          <div className="text-xs text-mm-txs font-semibold">
            El pedido cambiará al estado <span className="font-extrabold text-mm-g uppercase">{nextStatusLabel}</span>.
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-wider text-mm-txw flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" /> Observaciones / Nota de Cambio
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej: Empacado en cajas refrigeradas, repartidor Carlos asignado, listo para recogida, etc."
            className="w-full h-28 px-4 py-3 rounded-2xl border border-mm-crd bg-white focus:border-mm-g focus:ring-2 focus:ring-mm-gll outline-none text-xs font-semibold text-mm-g transition-all resize-none placeholder:text-mm-txw/70"
          />
          <p className="text-[10px] text-mm-txw italic font-medium">
            * Esta nota quedará registrada en el historial de auditoría de la orden.
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="rounded-xl px-4 h-10 border border-mm-crd text-mm-txs hover:bg-mm-gbg hover:text-mm-g transition-colors font-bold"
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleConfirm}
            className="rounded-xl px-5 h-10 shadow-lg shadow-mm-g/10 bg-mm-g text-white hover:bg-mm-gm font-bold text-xs"
          >
            {actionLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
