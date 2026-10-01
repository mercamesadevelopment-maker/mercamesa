'use client';

import React, { useState } from 'react';
import { Button, Select, Textarea } from '@/src/components/Shared';
import { getPqrsReason, PQRS_LIABLE_LABELS, type PqrsLiable } from '@/lib/pqrs/reasons';
import { PQRS_OUTCOME_LABELS, type PqrsOutcome } from '@/lib/pqrs/types';

interface PqrsResolveFormProps {
  reasonKey: string;
  working: boolean;
  onResolve: (input: { outcome: string; liable: string | null; notes: string }) => Promise<boolean>;
}

/** El administrador cierra el caso: resultado, quién asume el costo y respuesta. */
export function PqrsResolveForm({ reasonKey, working, onResolve }: PqrsResolveFormProps) {
  const sugerido = getPqrsReason(reasonKey)?.defaultLiable ?? null;

  const [outcome, setOutcome] = useState<PqrsOutcome | ''>('');
  const [liable, setLiable] = useState<PqrsLiable | ''>(sugerido ?? '');
  const [notes, setNotes] = useState('');

  const listo = outcome !== '' && notes.trim().length >= 10;

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

        {/* Solo al aprobar hay un costo que asignar. */}
        {outcome === 'approved' && (
          <Select label="Lo asume" value={liable} onChange={(e) => setLiable(e.target.value as PqrsLiable | '')}>
            <option value="">Nadie / no aplica</option>
            {(Object.keys(PQRS_LIABLE_LABELS) as PqrsLiable[]).map((l) => (
              <option key={l} value={l}>
                {PQRS_LIABLE_LABELS[l]}
              </option>
            ))}
          </Select>
        )}
      </div>

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
          onClick={() => onResolve({ outcome, liable: outcome === 'approved' ? liable || null : null, notes })}
        >
          Resolver
        </Button>
      </div>
    </div>
  );
}
