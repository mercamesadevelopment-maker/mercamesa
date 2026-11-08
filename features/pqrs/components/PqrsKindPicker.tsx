import React from 'react';
import { cn } from '@/lib/utils/cn';
import { PQRS_KIND_HELP, PQRS_KIND_LABELS, type PqrsKind } from '@/lib/pqrs/reasons';

interface PqrsKindPickerProps {
  kinds: PqrsKind[];
  value: PqrsKind | '';
  onChange: (kind: PqrsKind) => void;
}

/** El primer paso de una PQRSF: qué se quiere radicar. */
export function PqrsKindPicker({ kinds, value, onChange }: PqrsKindPickerProps) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-mm-txs ml-1 mb-1.5">¿Qué quieres radicar?</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {kinds.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onChange(k)}
            aria-pressed={value === k}
            className={cn(
              'rounded-2xl border px-4 py-3 text-left transition-colors',
              value === k ? 'border-mm-g bg-mm-gbg/50 ring-1 ring-mm-g' : 'border-mm-crd bg-white hover:border-mm-g/40'
            )}
          >
            <span className="block font-bold text-mm-g text-sm">{PQRS_KIND_LABELS[k]}</span>
            <span className="block text-xs text-mm-txs mt-0.5">{PQRS_KIND_HELP[k]}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
