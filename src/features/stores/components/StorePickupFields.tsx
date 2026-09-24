'use client';

import React from 'react';
import { Truck } from 'lucide-react';
import { Input, cn } from '@/src/components/Shared';
import { MapPicker, type MapPickerChange } from '@/components/ui/map-picker/MapPicker';

export interface StorePickupValues {
  address: string;
  city: string;
  department: string;
  /** Texto, no número: los dos formularios guardan todo el estado como cadenas. */
  latitude: string;
  longitude: string;
}

interface StorePickupFieldsProps {
  values: StorePickupValues;
  onChange: (values: StorePickupValues) => void;
  /** Nombre de la plaza, para explicar qué pasa si se deja vacío. */
  marketplaceName?: string | null;
  error?: string | null;
  disabled?: boolean;
  className?: string;
}

/**
 * Dirección donde el mensajero recoge los pedidos de esta tienda.
 *
 * Vive en `src/features/stores` y no dentro de `app/admin` por la misma razón
 * que `StoreContactFields`: que el tendero importara un componente del admin
 * mezclaría dos features que el repo mantiene separadas a propósito.
 *
 * Es opcional. Vacía, se sigue recogiendo en la dirección de la plaza, que es lo
 * que hacen hoy casi todas las tiendas. Solo hace falta cuando la tienda
 * despacha por su cuenta y no desde su plaza.
 */
export function StorePickupFields({
  values,
  onChange,
  marketplaceName,
  error,
  disabled,
  className,
}: StorePickupFieldsProps) {
  const set = (field: keyof StorePickupValues) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => onChange({ ...values, [field]: e.target.value });

  /** El mapa devuelve números; el formulario los guarda como texto. */
  const handleMapChange = (change: MapPickerChange) => {
    onChange({
      ...values,
      latitude: String(change.latitude),
      longitude: String(change.longitude),
      address: change.addressLine || values.address,
      city: change.municipality || values.city,
      department: change.department || values.department,
    });
  };

  const tienePunto = Boolean(values.latitude && values.longitude);
  const tieneDireccion = Boolean(values.address.trim());

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-start gap-2 rounded-2xl border border-mm-crd bg-mm-gbg/20 p-4">
        <Truck className="mt-0.5 h-4 w-4 shrink-0 text-mm-txw" />
        <div className="text-xs text-mm-txs">
          <p className="font-bold text-mm-g">¿Dónde se recogen los pedidos?</p>
          <p className="mt-1">
            Déjalo vacío si el mensajero recoge en la dirección de
            {marketplaceName ? ` ${marketplaceName}` : ' tu plaza'}. Llénalo solo si esta tienda
            despacha desde su propia dirección.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Dirección de recogida"
          value={values.address}
          onChange={set('address')}
          placeholder="Ej: Calle 50 # 50-50"
          disabled={disabled}
        />
        <Input
          label="Ciudad"
          value={values.city}
          onChange={set('city')}
          placeholder="Ej: Medellín"
          disabled={disabled}
        />
        <Input
          label="Departamento"
          value={values.department}
          onChange={set('department')}
          placeholder="Ej: Antioquia"
          disabled={disabled}
        />
      </div>

      <MapPicker
        latitude={values.latitude ? Number(values.latitude) : null}
        longitude={values.longitude ? Number(values.longitude) : null}
        onChange={handleMapChange}
        label="Punto de recogida en el mapa"
        helpText="Busca la dirección o marca el punto. Es donde el mensajero va a recoger."
        initialQuery={values.address}
      />

      {/* La dirección sin punto no se puede guardar: obligaría a Pibox a
          adivinar dónde queda, y el mensajero acaba en otro lado. */}
      {tieneDireccion && !tienePunto && (
        <p className="ml-1 text-xs font-medium text-amber-700">
          Marca el punto en el mapa para poder guardar esta dirección.
        </p>
      )}

      {error && <p className="ml-1 text-xs font-medium text-r">{error}</p>}
    </div>
  );
}
