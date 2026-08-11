'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button, Input } from '@/src/components/Shared';
import { Modal } from '@/components/ui/modal/modal';
import { MapPicker } from '@/components/ui/map-picker/MapPicker';
import type { AddressFormValues, DeliveryAddress } from '../types/address.types';

export const EMPTY_ADDRESS_FORM: AddressFormValues = {
  label: '',
  address_line: '',
  neighborhood: '',
  municipality: '',
  department: '',
  is_default: false,
  latitude: null,
  longitude: null,
};

export function addressToFormValues(addr: DeliveryAddress): AddressFormValues {
  return {
    label: addr.label ?? '',
    address_line: addr.address_line,
    neighborhood: addr.neighborhood ?? '',
    municipality: addr.municipality,
    department: addr.department,
    is_default: addr.is_default,
    latitude: addr.latitude ?? null,
    longitude: addr.longitude ?? null,
  };
}

interface AddressFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (form: AddressFormValues) => Promise<void>;
  /** Si viene, el modal edita esa dirección; si no, crea una nueva. */
  editing?: DeliveryAddress | null;
  submitting?: boolean;
  error?: string | null;
}

/**
 * Formulario de dirección, compartido por el perfil y por el carrito.
 *
 * Vivía embebido en addresses-tab.tsx; se extrajo para que el comprador pueda
 * crear una dirección durante el checkout sin abandonar el carrito, y para que
 * el mapa y las validaciones existan una sola vez.
 */
export function AddressFormModal({
  isOpen,
  onClose,
  onSubmit,
  editing = null,
  submitting = false,
  error = null,
}: AddressFormModalProps) {
  const [form, setForm] = useState<AddressFormValues>(EMPTY_ADDRESS_FORM);

  // Recarga los valores cada vez que se abre, para no arrastrar lo tecleado
  // en una apertura anterior.
  useEffect(() => {
    if (!isOpen) return;
    setForm(editing ? addressToFormValues(editing) : EMPTY_ADDRESS_FORM);
  }, [isOpen, editing]);

  const field = (key: 'label' | 'address_line' | 'neighborhood' | 'municipality' | 'department') => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value })),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(form);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !submitting && onClose()}
      title={editing ? 'Editar Dirección' : 'Nueva Dirección'}
      maxWidth="max-w-lg"
    >
      <div className="p-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Etiqueta (ej: Casa, Trabajo)" {...field('label')} placeholder="Opcional" />
          <Input label="Dirección" {...field('address_line')} placeholder="Ej: Calle 45 # 23-12" required />
          <Input label="Barrio / Sector" {...field('neighborhood')} placeholder="Opcional" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Municipio" {...field('municipality')} placeholder="Ej: Medellín" required />
            <Input label="Departamento" {...field('department')} placeholder="Ej: Antioquia" required />
          </div>

          <MapPicker
            latitude={form.latitude}
            longitude={form.longitude}
            onChange={(lat, lon) => setForm((prev) => ({ ...prev, latitude: lat, longitude: lon }))}
          />

          <div className="flex items-center gap-3 p-4 bg-mm-gbg/10 rounded-2xl border border-mm-crd">
            <input
              type="checkbox"
              id="is_default"
              checked={form.is_default}
              onChange={(e) => setForm((prev) => ({ ...prev, is_default: e.target.checked }))}
              className="w-5 h-5 rounded border-mm-crd text-mm-g focus:ring-mm-g"
            />
            <label htmlFor="is_default" className="text-sm font-bold text-mm-g cursor-pointer">
              Establecer como dirección predeterminada
            </label>
          </div>

          {error && (
            <p className="text-sm text-r font-medium bg-rl px-4 py-2 rounded-xl">{error}</p>
          )}

          <div className="pt-4 flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 flex items-center justify-center gap-2" disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? 'Guardar Cambios' : 'Agregar Dirección'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
