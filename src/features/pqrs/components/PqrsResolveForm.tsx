'use client';

import React, { useState } from 'react';
import { Button, Select, Textarea } from '@/src/components/Shared';
import { getPqrsReason, PQRS_LIABLE_LABELS, type PqrsLiable } from '@/lib/pqrs/reasons';
import { PQRS_OUTCOME_LABELS, type PqrsOutcome } from '@/lib/pqrs/types';
import type { PqrsResolveInput } from '../services/pqrs.service';

interface PqrsResolveFormProps {
  reasonKey: string;
  /** El caso tiene algo que devolver: pedido pagado y un motivo que devuelve. */
  canRefund: boolean;
  working: boolean;
  onResolve: (input: PqrsResolveInput) => Promise<boolean>;
}

type RefundChoice = 'items' | 'order' | 'none';

const REFUND_LABELS: Record<RefundChoice, string> = {
  items: 'Los productos marcados',
  order: 'El pedido completo, con domicilio',
  none: 'Nada: se aprueba sin devolución',
};

/** Quién puede asumir una devolución. El comprador no: sería no devolverle. */
const REFUND_LIABLES: PqrsLiable[] = ['store', 'logistics', 'platform'];

/** El administrador cierra el caso: resultado, qué se devuelve, quién lo asume y la respuesta. */
export function PqrsResolveForm({ reasonKey, canRefund, working, onResolve }: PqrsResolveFormProps) {
  const reason = getPqrsReason(reasonKey);
  const sugerido = reason?.defaultLiable ?? null;
  const refundPorDefecto: RefundChoice = canRefund && reason ? reason.refund : 'none';

  const [outcome, setOutcome] = useState<PqrsOutcome | ''>('');
  const [refund, setRefund] = useState<RefundChoice>(refundPorDefecto);
  const [liable, setLiable] = useState<PqrsLiable | ''>(sugerido ?? '');
  const [notes, setNotes] = useState('');

  const devuelve = outcome === 'approved' && refund !== 'none';
  const liables = devuelve ? REFUND_LIABLES : (Object.keys(PQRS_LIABLE_LABELS) as PqrsLiable[]);
  // Con devolución hay que decir quién la asume; sin ella es opcional.
  const responsableValido = !devuelve || REFUND_LIABLES.includes(liable as PqrsLiable);
  const listo = outcome !== '' && notes.trim().length >= 10 && responsableValido;

  return (
    <div className="rounded-2xl border border-mm-crd bg-mm-gbg/30 p-4 space-y-3">
      <p className="font-bold text-mm-g">Resolver el caso</p>

      <div className="grid sm:grid-cols-2 gap-3">
        <Select label="Resultado" value={outcome} onChange={(e) => setOutcome(e.target.value as PqrsOutcome | '')}>
          <option value="">Elige…</option>
          {(Object.keys(PQRS_OUTCOME_LABELS) as PqrsOutcome[]).map((o) => (
            <option key={o} value={o}>
              {PQRS_OUTCOME_LABELS[o]}
            </option>
          ))}
        </Select>

        {/* Solo al aprobar hay algo que devolver y un costo que asignar. */}
        {outcome === 'approved' && refundPorDefecto !== 'none' && (
          <Select label="Se devuelve" value={refund} onChange={(e) => setRefund(e.target.value as RefundChoice)}>
            {(Object.keys(REFUND_LABELS) as RefundChoice[]).map((r) => (
              <option key={r} value={r}>
                {REFUND_LABELS[r]}
              </option>
            ))}
          </Select>
        )}

        {outcome === 'approved' && (
          <Select label="Lo asume" value={liable} onChange={(e) => setLiable(e.target.value as PqrsLiable | '')}>
            <option value="">{devuelve ? 'Elige…' : 'Nadie / no aplica'}</option>
            {liables.map((l) => (
              <option key={l} value={l}>
                {PQRS_LIABLE_LABELS[l]}
              </option>
            ))}
          </Select>
        )}
      </div>

      {devuelve && (
        <p className="text-xs text-mm-txw">
          Al resolver, el comprador recibe el saldo a favor de inmediato. Si lo asume la tienda, el valor de los
          productos se le descuenta en su próximo pago.
        </p>
      )}

      <Textarea
        label="Respuesta"
        rows={3}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        hint="La lee quien radicó el caso."
      />

      <div className="flex justify-end">
        <Button
          size="sm"
          loading={working}
          disabled={!listo}
          onClick={() =>
            onResolve({
              outcome,
              liable: outcome === 'approved' ? liable || null : null,
              notes,
              refund: outcome === 'approved' ? refund : 'none',
            })
          }
        >
          Resolver
        </Button>
      </div>
    </div>
  );
}
