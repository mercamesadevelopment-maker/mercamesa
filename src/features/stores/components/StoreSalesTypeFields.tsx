'use client';

import React from 'react';
import { cn } from '@/src/components/Shared';

export interface StoreSalesTypeValues {
  is_wholesale: boolean;
  is_retail: boolean;
}

interface StoreSalesTypeFieldsProps {
  values: StoreSalesTypeValues;
  onChange: (field: keyof StoreSalesTypeValues, value: boolean) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * A quién le vende la tienda: al por mayor, al detal o ambas.
 *
 * Son dos casillas y no una sola opción a propósito, porque en la plaza el mismo
 * local vende un bulto y vende una libra. Se dice explícitamente en la ayuda,
 * porque quien ve dos casillas suele asumir que son excluyentes.
 *
 * Compartido por el formulario del admin (`StoreModal`) y el del tendero
 * (`StoreProfileTab`), igual que `StoreContactFields`.
 */
export function StoreSalesTypeFields({
  values,
  onChange,
  disabled,
  className,
}: StoreSalesTypeFieldsProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label className="ml-1 text-sm font-medium text-mm-txs">Tipo de venta</label>

      <div className="flex flex-wrap gap-x-6 gap-y-2 px-1 py-1">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={values.is_retail}
            disabled={disabled}
            onChange={(e) => onChange('is_retail', e.target.checked)}
            className="h-4 w-4 rounded border-mm-crd text-mm-g focus:ring-mm-g"
          />
          <span className="text-sm text-mm-txs">Al detal (minorista)</span>
        </label>

        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={values.is_wholesale}
            disabled={disabled}
            onChange={(e) => onChange('is_wholesale', e.target.checked)}
            className="h-4 w-4 rounded border-mm-crd text-mm-g focus:ring-mm-g"
          />
          <span className="text-sm text-mm-txs">Al por mayor (mayorista)</span>
        </label>
      </div>

      <p className="ml-1 text-xs text-mm-txw">
        Puedes marcar las dos si vendes tanto por unidad como por bulto.
      </p>
    </div>
  );
}
