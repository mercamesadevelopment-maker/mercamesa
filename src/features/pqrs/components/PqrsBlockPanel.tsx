'use client';

import React, { useState } from 'react';
import { Ban } from 'lucide-react';
import { Button, Textarea } from '@/src/components/Shared';
import { fechaCompleta } from '@/lib/dates/relative-time';
import type { PqrsBlock, PqrsBuyerHistory } from '@/lib/pqrs/types';

interface PqrsBlockPanelProps {
  history: PqrsBuyerHistory | null;
  block: PqrsBlock | null;
  canLift: boolean;
  working: boolean;
  onLift: (notes: string) => Promise<boolean>;
}

function Cifra({ valor, etiqueta }: { valor: number; etiqueta: string }) {
  return (
    <div className="rounded-xl bg-white border border-mm-crd px-3 py-2 text-center">
      <p className="text-lg font-bold text-mm-g leading-none">{valor}</p>
      <p className="text-[11px] text-mm-txw mt-1">{etiqueta}</p>
    </div>
  );
}

/**
 * Lo propio de un caso del tendero contra un comprador: cómo le ha ido a ese
 * comprador en la tienda y, si la solicitud era de bloqueo y se aprobó, el
 * estado del bloqueo.
 */
export function PqrsBlockPanel({ history, block, canLift, working, onLift }: PqrsBlockPanelProps) {
  const [notes, setNotes] = useState('');

  if (!history && !block) return null;

  return (
    <div className="space-y-4">
      {history && (
        <div>
          <p className="text-xs text-mm-txw font-bold uppercase tracking-widest mb-1.5">
            El comprador en esta tienda
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <Cifra valor={history.total} etiqueta="Pedidos" />
            <Cifra valor={history.delivered} etiqueta="Entregados" />
            <Cifra valor={history.cancelled} etiqueta="Cancelados" />
            <Cifra valor={history.expiredUnpaid} etiqueta="Vencidos sin pagar" />
            <Cifra valor={history.paymentRejected} etiqueta="Pago rechazado" />
          </div>
        </div>
      )}

      {block && (
        <div className="rounded-2xl border border-mm-crd bg-mm-gbg/30 p-4 space-y-3">
          <p className="flex items-center gap-2 font-bold text-mm-g">
            <Ban className="w-4 h-4" />
            {block.liftedAt ? 'Bloqueo levantado' : 'Comprador bloqueado en esta tienda'}
          </p>
          <p className="text-xs text-mm-txs">
            Bloqueado el {fechaCompleta(block.createdAt)}.
            {block.liftedAt && ` Levantado el ${fechaCompleta(block.liftedAt)}: ${block.liftNotes ?? ''}`}
          </p>

          {canLift && (
            <>
              <Textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Por qué se levanta el bloqueo."
              />
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  loading={working}
                  disabled={notes.trim().length < 10}
                  onClick={async () => {
                    if (await onLift(notes)) setNotes('');
                  }}
                >
                  Levantar el bloqueo
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
