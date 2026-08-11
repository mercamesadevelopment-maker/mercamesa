'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAddresses } from '../hooks/use-addresses';
import type { AddressFormValues, DeliveryAddress } from '../types/address.types';
import { Button, Badge } from '@/src/components/Shared';
import { MapPin, Plus, Edit2, Trash2, Loader2 } from 'lucide-react';
import { AddressFormModal } from './address-form-modal';

export function AddressesTab() {
  const { addresses, loading, error, fetchAddresses, createAddress, updateAddress, deleteAddress } =
    useAddresses();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<DeliveryAddress | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchAddresses();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAdd = () => {
    setEditing(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEdit = (addr: DeliveryAddress) => {
    setEditing(addr);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (form: AddressFormValues) => {
    setSubmitting(true);
    setFormError(null);
    try {
      if (editing) {
        await updateAddress(editing.id, form);
      } else {
        await createAddress(form);
      }
      setIsModalOpen(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAddress(id);
    } catch {
      // error visible en el banner superior
    }
  };

  return (
    <>
      <motion.div
        key="addresses"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="space-y-6"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-fraunces text-mm-g"></h2>
          <Button size="sm" onClick={openAdd} disabled={loading}>
            <Plus className="w-4 h-4" /> Agregar
          </Button>
        </div>

        {/* Global error banner */}
        {error && (
          <div className="bg-rl text-r text-sm font-medium px-4 py-3 rounded-2xl">
            {error}
          </div>
        )}

        <div className="grid gap-4">
          {loading && addresses.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-mm-txw" />
            </div>
          ) : addresses.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-3xl border border-mm-crd border-dashed">
              <p className="text-mm-txw">No tienes direcciones guardadas.</p>
            </div>
          ) : (
            addresses.map((addr) => (
              <div
                key={addr.id}
                className="bg-white p-6 rounded-3xl border border-mm-crd shadow-sm flex items-center gap-6"
              >
                <div className="w-14 h-14 bg-mm-gbg rounded-2xl flex items-center justify-center shrink-0 text-mm-g">
                  <MapPin className="w-7 h-7" />
                </div>
                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4 className="font-bold text-mm-g">
                      {addr.label ?? addr.address_line}
                    </h4>
                    {addr.is_default && (
                      <Badge variant="success" className="text-[10px]">
                        Predeterminada
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-mm-txs truncate">
                    {addr.address_line}
                    {addr.neighborhood ? `, ${addr.neighborhood}` : ''}
                  </p>
                  <p className="text-xs text-mm-txw">
                    {addr.municipality}, {addr.department}
                  </p>
                  {(addr.latitude === null || addr.longitude === null) && (
                    <p className="text-[11px] text-amber-700 mt-1">
                      Sin ubicación en el mapa — el mensajero podría no encontrarla.
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    className="p-2 hover:bg-mm-gbg rounded-full text-mm-txw hover:text-mm-g transition-colors"
                    onClick={() => openEdit(addr)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    className="p-2 hover:bg-mm-gbg rounded-full text-mm-txw hover:text-r transition-colors"
                    onClick={() => handleDelete(addr.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>

      <AddressFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSave}
        editing={editing}
        submitting={submitting}
        error={formError}
      />
    </>
  );
}
