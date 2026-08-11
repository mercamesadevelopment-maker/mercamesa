'use client';

import { useEffect, useState } from 'react';
import { MapPin, Plus, Loader2, AlertTriangle } from 'lucide-react';
import { useAddresses } from '@/app/profile/hooks/use-addresses';
import { AddressFormModal } from '@/app/profile/components/address-form-modal';
import type { AddressFormValues } from '@/app/profile/types/address.types';

interface DeliveryAddressSelectorProps {
  selectedAddressId: string | null;
  onSelect: (addressId: string) => void;
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
}: DeliveryAddressSelectorProps) {
  const { addresses, loading, error, fetchAddresses, createAddress } = useAddresses();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  // Preselecciona la predeterminada (o la primera) apenas cargan las direcciones.
  useEffect(() => {
    if (selectedAddressId || addresses.length === 0) return;
    const preferred = addresses.find((a) => a.is_default) ?? addresses[0];
    onSelect(preferred.id);
  }, [addresses, selectedAddressId, onSelect]);

  const handleCreate = async (form: AddressFormValues) => {
    setSubmitting(true);
    setFormError(null);
    try {
      const created = await createAddress(form);
      setIsFormOpen(false);
      // Se selecciona sola: el comprador la creó justo para este pedido.
      if (created?.id) onSelect(created.id);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar la dirección');
    } finally {
      setSubmitting(false);
    }
  };

  const selected = addresses.find((a) => a.id === selectedAddressId);
  const selectedSinCoords =
    selected && (selected.latitude === null || selected.longitude === null);

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-mm-g flex items-center gap-1.5">
          <MapPin className="w-4 h-4" /> Dirección de entrega
        </h3>
        {addresses.length > 0 && (
          <button
            type="button"
            onClick={() => { setFormError(null); setIsFormOpen(true); }}
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
            onClick={() => { setFormError(null); setIsFormOpen(true); }}
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
              </div>
            </label>
          ))}
        </div>
      )}

      {/* El domicilio se despacha con las coordenadas de la dirección; sin ellas
          el mensajero depende de que la dirección escrita sea geocodificable. */}
      {selectedSinCoords && (
        <div className="flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl mt-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
          <span>
            Esta dirección no tiene un punto marcado en el mapa. Edítala desde tu perfil
            para que el mensajero la encuentre con precisión.
          </span>
        </div>
      )}

      <AddressFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleCreate}
        submitting={submitting}
        error={formError}
      />
    </div>
  );
}
