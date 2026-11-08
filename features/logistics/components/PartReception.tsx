import React from 'react';
import { AlertTriangle, Camera } from 'lucide-react';
import { PhotoGrid } from '@/components/ui/photo-grid';
import { cn } from '@/lib/utils/cn';
import { fechaCompleta } from '@/lib/dates/relative-time';
import type { LogisticsPart } from '@/lib/logistics/orders';

/** Cómo quedó registrada la recepción: fotos, observación y si llegó algo mal. */
export function PartReception({ part, busy, onEdit }: { part: LogisticsPart; busy: boolean; onEdit: () => void }) {
  const r = part.reception;
  if (!r) return null;

  return (
    <div className={cn('rounded-2xl border px-3 py-2.5 space-y-2', r.damaged ? 'border-arcilla bg-arcilla-clara' : 'border-mm-crd')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-mm-txs">
          <span className="font-bold text-mm-g">{fechaCompleta(r.receivedAt)}</span>
          {r.receivedByName ? ` · ${r.receivedByName}` : ''}
        </p>
        {r.damaged && (
          <span className="flex items-center gap-1 text-xs font-bold text-arcilla-oscura">
            <AlertTriangle className="w-3.5 h-3.5" /> Con novedad
          </span>
        )}
      </div>
      <PhotoGrid photos={r.photos} className="w-16 h-16" />
      {r.observation && <p className="text-xs text-mm-g">{r.observation}</p>}
      {part.canEditEvidence && (
        <button
          type="button"
          onClick={onEdit}
          disabled={busy}
          className="flex items-center gap-1.5 text-xs font-bold text-mm-g underline disabled:opacity-50"
        >
          <Camera className="w-3.5 h-3.5" /> Agregar fotos u observación
        </button>
      )}
    </div>
  );
}
