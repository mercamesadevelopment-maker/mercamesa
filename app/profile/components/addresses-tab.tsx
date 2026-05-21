'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAddresses } from '../hooks/use-addresses';
import type { AddressFormValues, DeliveryAddress } from '../types/address.types';
import { Button, Badge, Input } from '@/src/components/Shared';
import { MapPin, Plus, Edit2, Trash2, XCircle, Loader2 } from 'lucide-react';

const EMPTY_FORM: AddressFormValues = {
  label: '',
  address_line: '',
  neighborhood: '',
  municipality: '',
  department: '',
  is_default: false,
};

export function AddressesTab() {
  const { addresses, loading, error, fetchAddresses, createAddress, updateAddress, deleteAddress } =
    useAddresses();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<DeliveryAddress | null>(null);
  const [form, setForm] = useState<AddressFormValues>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchAddresses();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEdit = (addr: DeliveryAddress) => {
    setEditing(addr);
    setForm({
      label: addr.label ?? '',
      address_line: addr.address_line,
      neighborhood: addr.neighborhood ?? '',
      municipality: addr.municipality,
      department: addr.department,
      is_default: addr.is_default,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const field = (key: keyof AddressFormValues) => ({
    value: form[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value })),
  });

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
          <h2 className="text-3xl font-fraunces text-mm-g">Mis Direcciones</h2>
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

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !submitting && setIsModalOpen(false)}
              className="absolute inset-0 bg-mm-g/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-[40px] shadow-2xl overflow-hidden max-w-lg w-full p-10"
            >
              <button
                onClick={() => setIsModalOpen(false)}
                disabled={submitting}
                className="absolute top-6 right-6 p-2 hover:bg-mm-gbg rounded-full transition-colors z-10 disabled:opacity-40"
              >
                <XCircle className="w-6 h-6 text-mm-txs" />
              </button>

              <h2 className="text-3xl font-fraunces text-mm-g mb-6">
                {editing ? 'Editar Dirección' : 'Nueva Dirección'}
              </h2>

              <form onSubmit={handleSave} className="space-y-4">
                <Input label="Etiqueta (ej: Casa, Trabajo)" {...field('label')} placeholder="Opcional" />
                <Input label="Dirección" {...field('address_line')} placeholder="Ej: Calle 45 # 23-12" required />
                <Input label="Barrio / Sector" {...field('neighborhood')} placeholder="Opcional" />
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Municipio" {...field('municipality')} placeholder="Ej: Medellín" required />
                  <Input label="Departamento" {...field('department')} placeholder="Ej: Antioquia" required />
                </div>

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

                {formError && (
                  <p className="text-sm text-r font-medium bg-rl px-4 py-2 rounded-xl">{formError}</p>
                )}

                <div className="pt-4 flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setIsModalOpen(false)}
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
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
