'use client';

import React from 'react';
import { Input, Select } from '@/components/ui/form-fields';
import { cn } from '@/lib/utils/cn';
import { needsCheckDigit, parseStoreIdentification } from '@/lib/stores/store-identification';
import type { IdentificationTypeOption } from '@/features/auth/hooks/use-identification-types';

export interface StoreIdentificationValues {
  identification_type_id: string;
  document_number: string;
  document_dv: string;
}

export const EMPTY_STORE_IDENTIFICATION: StoreIdentificationValues = {
  identification_type_id: '',
  document_number: '',
  document_dv: '',
};

/** Los valores del formulario a partir de la tienda guardada. */
export function storeIdentificationFrom(store: Record<string, unknown> | null | undefined): StoreIdentificationValues {
  return {
    identification_type_id: String(store?.identification_type_id ?? ''),
    document_number: String(store?.document_number ?? ''),
    document_dv: String(store?.document_dv ?? ''),
  };
}

/**
 * El error de la identificación antes de enviar, con la misma regla del
 * servidor (`parseStoreIdentification`), o `null` si está bien.
 */
export function storeIdentificationError(
  values: StoreIdentificationValues,
  types: IdentificationTypeOption[]
): string | null {
  const slug = types.find((t) => t.id === values.identification_type_id)?.slug ?? null;
  const r = parseStoreIdentification({ ...values }, slug);
  return 'error' in r ? r.error : null;
}

interface StoreIdentificationFieldsProps {
  values: StoreIdentificationValues;
  onChange: (values: StoreIdentificationValues) => void;
  types: IdentificationTypeOption[];
  /** El error que devolvió el servidor al guardar. */
  error?: string | null;
  disabled?: boolean;
  className?: string;
}

/**
 * NIT o cédula de la tienda. Lo comparten el formulario del admin (`StoreModal`)
 * y el del tendero (`StoreProfileTab`), como `StoreContactFields`.
 *
 * Con NIT o RUT se pide el dígito de verificación escrito: el servidor lo
 * comprueba contra el número (`lib/stores/store-identification.ts`).
 */
export function StoreIdentificationFields({ values, onChange, types, error, disabled, className }: StoreIdentificationFieldsProps) {
  const tipo = types.find((t) => t.id === values.identification_type_id);
  const conDv = needsCheckDigit(tipo?.slug);

  const set = (cambio: Partial<StoreIdentificationValues>) => onChange({ ...values, ...cambio });

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className={cn('grid gap-4', conDv ? 'sm:grid-cols-[1fr_1.4fr_6rem]' : 'sm:grid-cols-[1fr_1.4fr]')}>
        <Select
          label="Tipo de identificación"
          name="identification_type_id"
          value={values.identification_type_id}
          onChange={(e) => {
            const nuevo = types.find((t) => t.id === e.target.value);
            if (!nuevo) return onChange(EMPTY_STORE_IDENTIFICATION);
            set({ identification_type_id: e.target.value, document_dv: needsCheckDigit(nuevo?.slug) ? values.document_dv : '' });
          }}
          disabled={disabled}
        >
          <option value="">Sin identificación</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
        <Input
          label={tipo ? `Número de ${tipo.name}` : 'Número'}
          name="document_number"
          value={values.document_number}
          onChange={(e) => set({ document_number: e.target.value })}
          placeholder={conDv ? 'Ej: 900123456' : 'Ej: 1020304050'}
          inputMode={tipo?.slug === 'pasaporte' ? 'text' : 'numeric'}
          disabled={disabled || !values.identification_type_id}
        />
        {conDv && (
          <Input
            label="DV"
            name="document_dv"
            value={values.document_dv}
            onChange={(e) => set({ document_dv: e.target.value.replace(/\D/g, '').slice(0, 1) })}
            placeholder="0"
            inputMode="numeric"
            maxLength={1}
            title="Dígito de verificación: el número después del guion en el RUT"
            disabled={disabled}
          />
        )}
      </div>
      <p className={cn('ml-1 text-xs', error ? 'text-r' : 'text-mm-txw')}>
        {error ?? 'Opcional. El NIT va sin puntos ni dígito de verificación; el DV va aparte.'}
      </p>
    </div>
  );
}
