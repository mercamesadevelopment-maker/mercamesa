'use client';

import React from 'react';
import { Input, cn } from '@/src/components/Shared';
import { PhoneInput } from '@/components/ui/phone-input/PhoneInput';

export interface StoreContactValues {
  contact_name: string;
  contact_email: string;
  phone: string;
  whatsapp: string;
}

interface StoreContactFieldsProps {
  values: StoreContactValues;
  onChange: (field: keyof StoreContactValues, value: string) => void;
  /** Mensaje bajo el correo, p. ej. cuando ya está registrado en otra tienda. */
  emailError?: string | null;
  disabled?: boolean;
  className?: string;
}

/**
 * Datos de contacto de una tienda, compartidos por los dos formularios que la
 * editan: el del admin (`StoreModal`) y el del tendero (`StoreProfileTab`).
 *
 * Vive en `src/features/stores` y no dentro de `app/admin`: que el tendero
 * importara un componente del admin mezclaría dos features que el repo mantiene
 * separadas a propósito.
 *
 * Solo el bloque repetido. Los formularios **no** se unifican: el del admin
 * tiene slug, plaza, estado y horarios, y el del tendero portada y ubicación
 * dentro de la plaza. Esa diferencia es un límite de permisos —un tendero no
 * puede cambiar su slug ni mudarse de plaza—, no un descuido.
 */
export function StoreContactFields({
  values,
  onChange,
  emailError,
  disabled,
  className,
}: StoreContactFieldsProps) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2', className)}>
      <Input
        label="Nombre de contacto"
        name="contact_name"
        value={values.contact_name}
        onChange={(e) => onChange('contact_name', e.target.value)}
        placeholder="Ej: José Pérez"
        disabled={disabled}
      />

      <Input
        label="Correo de contacto"
        name="contact_email"
        type="email"
        value={values.contact_email}
        onChange={(e) => onChange('contact_email', e.target.value)}
        placeholder="tienda@correo.com"
        error={emailError || undefined}
        disabled={disabled}
      />

      <PhoneInput
        label="Teléfono"
        name="phone"
        value={values.phone}
        onChange={(v) => onChange('phone', v)}
        disabled={disabled}
      />

      <PhoneInput
        label="WhatsApp"
        name="whatsapp"
        value={values.whatsapp}
        onChange={(v) => onChange('whatsapp', v)}
        disabled={disabled}
      />
    </div>
  );
}
