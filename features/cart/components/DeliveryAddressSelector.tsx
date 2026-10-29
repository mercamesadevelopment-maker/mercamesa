'use client';

import { useEffect, useState } from 'react';
import { MapPin, Plus, Loader2, AlertTriangle } from 'lucide-react';
import { useAddresses } from '@/app/profile/hooks/use-addresses';
import { AddressFormModal } from '@/app/profile/components/address-form-modal';
import type { AddressFormValues, DeliveryAddress } from '@/app/profile/types/address.types';

const hasCoords = (a: DeliveryAddress) => a.latitude !== null && a.longitude !== null;

interface DeliveryAddressSelectorProps {
  selectedAddressId: string | null;
  onSelect: (addressId: string) => void;
  /**
   * Avisa al carrito si la dirección elegida sirve para despachar. Sin
   * coordenadas Pibox no puede cotizar fuera de 6 ciudades, así que el pedido no
   * debe poder confirmarse.
   */
  onReadyChange?: (ready: boolean) => void;
}

/**
 * Permite elegir a cuál de las direcciones guardadas se envía el pedido.
 *
 * Antes el checkout tomaba siempre la marcada como predeterminada sin
 * preguntar, y si no había ninguna creaba la orden sin dirección en silencio.
 */
export function DeliveryAddressSelector({
  selectedAddressId,
  onSelect,
  onReadyChange,
}: DeliveryAddressSelectorProps) {
  const { addresses, loading, error, fetchAddresses, createAddress, updateAddress } =
    useAddresses();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<DeliveryAddress | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  // Preselecciona la predeterminada, pero **prefiriendo una que sí se pueda
  // despachar**. Antes tomaba la predeterminada aunque no tuviera coordenadas, y
  // el comprador quedaba bloqueado sin entender por qué teniendo otras válidas.
  useEffect(() => {
    if (selectedAddressId || addresses.length === 0) return;
    const usable = addresses.filter(hasCoords);
    const pool = usable.length > 0 ? usable : addresses;
    const preferred = pool.find((a) => a.is_default) ?? pool[0];
    onSelect(preferred.id);
  }, [addresses, selectedAddressId, onSelect]);

  const selected = addresses.find((a) => a.id === selectedAddressId);
  const selectedSinCoords = !!selected && !hasCoords(selected);

  useEffect(() => {
    onReadyChange?.(!!selected && hasCoords(selected));
  }, [selected, onReadyChange]);

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    setIsFormOpen(true);
  };

  const openComplete = () => {
    if (!selected) return;
    setEditing(selected);
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleSubmit = async (form: AddressFormValues) => {
    setSubmitting(true);
    setFormError(null);
    try {
      if (editing) {
        await updateAddress(editing.id, form);
        setIsFormOpen(false);
        setEditing(null);
        // Se relee para que la lista refleje las coordenadas nuevas y el
        // bloqueo se levante sin recargar la página.
        await fetchAddresses();
      } else {
        const created = await createAddress(form);
        setIsFormOpen(false);
        // Se selecciona sola: el comprador la creó justo para este pedido.
        if (created?.id) onSelect(created.id);
      }
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar la dirección');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-mm-g flex items-center gap-1.5">
          <MapPin className="w-4 h-4" /> Dirección de entrega
        </h3>
        {addresses.length > 0 && (
          <button
            type="button"
            onClick={openCreate}
            className="text-xs font-bold text-mm-g hover:text-mm-oro transition-colors flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Agregar
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs text-r font-medium bg-rl px-3 py-2 rounded-xl mb-2">{error}</p>
      )}

      {loading && addresses.length === 0 ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-mm-txw" />
        </div>
      ) : addresses.length === 0 ? (
        <div className="bg-white border border-dashed border-mm-crd rounded-2xl p-4 text-center">
          <p className="text-xs text-mm-txs mb-3">
            No tienes direcciones guardadas. Agrega una para poder recibir tu pedido.
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-mm-g hover:text-mm-oro transition-colors"
          >
            <Plus className="w-4 h-4" /> Agregar dirección
          </button>
        </div>
      ) : (
        <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
          {addresses.map((addr) => (
            <label
              key={addr.id}
              className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-colors ${
                addr.id === selectedAddressId
                  ? 'border-mm-g bg-mm-gbg/30'
                  : 'border-mm-crd bg-white hover:bg-mm-gbg/10'
              }`}
            >
              <input
                type="radio"
                name="delivery-address"
                checked={addr.id === selectedAddressId}
                onChange={() => onSelect(addr.id)}
                className="mt-0.5 shrink-0"
              />
              <div className="min-w-0">
                <p className="text-sm font-bold text-mm-g truncate">
                  {addr.label || addr.address_line}
                  {addr.is_default && (
                    <span className="ml-1.5 text-[10px] font-bold text-mm-txw uppercase">
                      predeterminada
                    </span>
                  )}
                </p>
                <p className="text-xs text-mm-txs truncate">
                  {addr.address_line}
                  {addr.neighborhood ? `, ${addr.neighborhood}` : ''}
                </p>
                <p className="text-[11px] text-mm-txw truncate">
                  {addr.municipality}, {addr.department}
                </p>
                {addr.delivery_instructions && (
                  <p className="text-[11px] text-mm-txs italic truncate">
                    {addr.delivery_instructions}
                  </p>
                )}
                {!hasCoords(addr) && (
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-amber-700">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    Sin ubicación en el mapa
                  </p>
                )}
              </div>
            </label>
          ))}
        </div>
      )}

      {/* Antes esto era solo un aviso y mandaba al perfil, así que el comprador
          salía del carrito a resolverlo. Ahora bloquea —sin coordenadas el
          pedido no se puede despachar— pero se corrige aquí mismo, con el mismo
          modal del perfil ya cargado con esta dirección. */}
      {selectedSinCoords && (
        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
          <div className="flex items-start gap-1.5 text-[11px] text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            <span>
              Esta dirección no tiene un punto marcado en el mapa y no podemos calcular
              el envío. Márcalo para continuar con tu pedido.
            </span>
          </div>
          <button
            type="button"
            onClick={openComplete}
            className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-amber-700"
          >
            <MapPin className="h-3.5 w-3.5" />
            Completar ubicación
          </button>
        </div>
      )}

      <AddressFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
        editing={editing}
        submitting={submitting}
        error={formError}
      />
    </div>
  );
}
