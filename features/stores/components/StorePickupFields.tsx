'use client';

import React, { useState } from 'react';
import { AlertTriangle, Truck } from 'lucide-react';
import { Input } from '@/components/ui/form-fields';
import { cn } from '@/lib/utils/cn';
import { MapPicker, type MapPickerChange } from '@/components/ui/map-picker/MapPicker';
import { hasOwnPickup, MARKETPLACE_PICKUP, type PickupValues } from '@/lib/stores/pickup-mode';

/** Texto, no número: los dos formularios guardan todo el estado como cadenas. */
export type StorePickupValues = PickupValues;

interface StorePickupFieldsProps {
  values: StorePickupValues;
  onChange: (values: StorePickupValues) => void;
  /** Nombre de la plaza, para la casilla y el aviso. */
  marketplaceName?: string | null;
  /**
   * Si la plaza tiene dirección. Sin ella, una tienda que despacha desde la
   * plaza no tiene de dónde pedir el mensajero, y hay que decirlo acá.
   * `undefined` cuando no se sabe: no se avisa.
   */
  marketplaceHasAddress?: boolean;
  error?: string | null;
  disabled?: boolean;
  className?: string;
}

/**
 * Desde dónde despacha la tienda: la bahía de su plaza o su propia dirección.
 *
 * Vive en `features/stores` y no dentro de `app/admin` por la misma razón
 * que `StoreContactFields`: que el tendero importara un componente del admin
 * mezclaría dos features que el repo mantiene separadas a propósito.
 *
 * Antes la única forma de despachar desde la plaza era dejar todo vacío, y el
 * mapa no deja quitar un punto ya marcado: una tienda que alguna vez tuvo
 * dirección no podía volver a la plaza ni juntarse en un pedido con las demás.
 * La casilla lo hace explícito y limpia todo de una vez.
 *
 * Los formularios le ponen `key` con el id de la tienda, para que la casilla
 * arranque de nuevo al abrir otra.
 */
export function StorePickupFields({
  values,
  onChange,
  marketplaceName,
  marketplaceHasAddress,
  error,
  disabled,
  className,
}: StorePickupFieldsProps) {
  // `null` mientras nadie la toque: se deduce de lo que trae la tienda. Así,
  // desmarcarla con los campos todavía vacíos no la vuelve a marcar sola, y una
  // tienda que llega con dirección arranca desmarcada aunque cargue después.
  const [desdePlazaElegido, setDesdePlazaElegido] = useState<boolean | null>(null);
  const desdePlaza = desdePlazaElegido ?? !hasOwnPickup(values);

  const plaza = marketplaceName ? marketplaceName : 'su plaza';

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

  const toggleDesdePlaza = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDesdePlazaElegido(e.target.checked);
    if (e.target.checked) onChange({ ...MARKETPLACE_PICKUP });
  };

  const tienePunto = Boolean(values.latitude && values.longitude);
  const tieneDireccion = Boolean(values.address.trim());

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-start gap-2 rounded-2xl border border-mm-crd bg-mm-gbg/20 p-4">
        <Truck className="mt-0.5 h-4 w-4 shrink-0 text-mm-txw" />
        <div className="space-y-2 text-xs text-mm-txs">
          <p className="font-bold text-mm-g">¿Dónde se recogen los pedidos?</p>
          <label className="flex items-start gap-2 text-sm font-medium text-mm-txs">
            <input
              type="checkbox"
              checked={desdePlaza}
              onChange={toggleDesdePlaza}
              disabled={disabled}
              className="mt-0.5 h-4 w-4 rounded border-mm-crd text-mm-g focus:ring-mm-g"
            />
            <span>Se recoge en la dirección de {plaza}</span>
          </label>
          <p>
            {desdePlaza
              ? `Despacha desde la bahía de ${plaza} y se puede juntar en un pedido con las demás tiendas que despachan desde ahí.`
              : 'Despacha desde su propia dirección: no se junta en un pedido con otras tiendas.'}
          </p>
        </div>
      </div>

      {desdePlaza && marketplaceHasAddress === false && (
        <p className="ml-1 flex items-start gap-1.5 text-xs font-medium text-amber-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {marketplaceName ?? 'La plaza'} no tiene dirección registrada: sin ella no se puede pedir el
          mensajero. Cárgala en Plazas.
        </p>
      )}

      {!desdePlaza && (
        <>
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

          {/* Las dos mitades tienen que estar. Una dirección sin punto obligaría a
              Pibox a adivinar dónde queda; un punto sin dirección no le dice nada al
              mensajero. Se avisa en los dos sentidos: al principio solo se miraba el
              primero, y marcar el punto sin dirección se guardaba "bien" y se perdía. */}
          {tieneDireccion && !tienePunto && (
            <p className="ml-1 text-xs font-medium text-amber-700">
              Marca el punto en el mapa para poder guardar esta dirección.
            </p>
          )}

          {tienePunto && !tieneDireccion && (
            <p className="ml-1 text-xs font-medium text-amber-700">
              Falta la dirección de este punto. Búscala arriba o escríbela a mano.
            </p>
          )}

          {!tieneDireccion && !tienePunto && (
            <p className="ml-1 text-xs text-mm-txw">
              Busca la dirección y marca el punto en el mapa. Si la dejas vacía, sigue despachando desde {plaza}.
            </p>
          )}
        </>
      )}

      {error && <p className="ml-1 text-xs font-medium text-r">{error}</p>}
    </div>
  );
}
