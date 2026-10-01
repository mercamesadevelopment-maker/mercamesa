'use client';

import React, { useState } from 'react';
import { Button, Textarea } from '@/src/components/Shared';
import { fechaCompleta } from '@/lib/dates/relative-time';

interface PqrsStoreResponseProps {
  dueAt: string | null;
  working: boolean;
  onRespond: (decision: 'accept' | 'reject', notes: string) => Promise<boolean>;
}

/**
 * La respuesta de la tienda a un reclamo.
 *
 * Aceptar deja el caso aprobado sin pasar por MercaMesa, así que el texto lo
 * dice antes del clic. No aceptar exige una explicación: es lo que van a leer el
 * comprador y quien decida.
 */
export function PqrsStoreResponse({ dueAt, working, onRespond }: PqrsStoreResponseProps) {
  const [notes, setNotes] = useState('');

  return (
    <div className="rounded-2xl border border-warn/30 bg-warnl/40 p-4 space-y-3">
      <div>
        <p className="font-bold text-mm-g">Este reclamo espera tu respuesta</p>
        <p className="text-xs text-mm-txs mt-0.5">
          {dueAt ? `Tienes hasta el ${fechaCompleta(dueAt)}. ` : ''}
          Si lo aceptas, queda aprobado. Si no lo aceptas o no respondes a tiempo, lo decide MercaMesa.
        </p>
      </div>

      <Textarea
        rows={3}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Tu respuesta. Es obligatoria si no aceptas el reclamo."
      />

      <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
        <Button
          variant="outline"
          size="sm"
          disabled={working || notes.trim().length < 10}
          onClick={() => onRespond('reject', notes)}
        >
          No acepto el reclamo
        </Button>
        <Button size="sm" loading={working} onClick={() => onRespond('accept', notes)}>
          Acepto el reclamo
        </Button>
      </div>
    </div>
  );
}
