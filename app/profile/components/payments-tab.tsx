'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '@/src/store';
import { PaymentMethod } from '@/src/types';
import { Button, Badge, Input } from '@/src/components/Shared';
import { CreditCard, Package, Plus, Trash2, XCircle } from 'lucide-react';

export function PaymentsTab() {
  const { state, dispatch } = useApp();
  const profile = state.buyerProfile;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    label: '',
    type: 'card' as 'card' | 'cash',
    number: '',
    exp: '',
    isDefault: false,
  });

  const openAdd = () => {
    setForm({ label: '', type: 'card', number: '', exp: '', isDefault: false });
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    let updated = [...profile.payments];
    const newPay: PaymentMethod = {
      id: String(Math.max(0, ...profile.payments.map((p) => Number(p.id))) + 1),
      ...form,
    };
    updated.push(newPay);

    if (form.isDefault) {
      updated = updated.map((p) => ({ ...p, isDefault: p.id === newPay.id }));
    }

    dispatch({ type: 'UPDATE_BUYER_PROFILE', profile: { payments: updated } });
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    dispatch({
      type: 'UPDATE_BUYER_PROFILE',
      profile: { payments: profile.payments.filter((p) => p.id !== id) },
    });
  };

  return (
    <>
      <motion.div
        key="payments"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="space-y-6"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-fraunces text-mm-g">Medios de Pago</h2>
          <Button size="sm" onClick={openAdd}>
            <Plus className="w-4 h-4" /> Agregar
          </Button>
        </div>

        <div className="grid gap-4">
          {profile.payments.map((pay) => (
            <div
              key={pay.id}
              className="bg-white p-6 rounded-3xl border border-mm-crd shadow-sm flex items-center gap-6"
            >
              <div className="w-14 h-14 bg-mm-gbg rounded-2xl flex items-center justify-center text-3xl shrink-0 text-mm-g">
                {pay.type === 'card' ? (
                  <CreditCard className="w-7 h-7" />
                ) : (
                  <Package className="w-7 h-7" />
                )}
              </div>
              <div className="flex-grow">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-bold text-mm-g">{pay.label}</h4>
                  {pay.isDefault && (
                    <Badge variant="success" className="text-[10px]">
                      Predeterminado
                    </Badge>
                  )}
                </div>
                {pay.type === 'card' ? (
                  <p className="text-sm text-mm-txs">Vence: {pay.exp}</p>
                ) : (
                  <p className="text-sm text-mm-txs">Pago contra entrega</p>
                )}
              </div>
              <button
                className="p-2 hover:bg-mm-gbg rounded-full text-mm-txw hover:text-r transition-colors"
                onClick={() => handleDelete(pay.id)}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          {profile.payments.length === 0 && (
            <div className="text-center py-12 bg-white rounded-3xl border border-mm-crd border-dashed">
              <p className="text-mm-txw">No tienes medios de pago guardados.</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Payment Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
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
                className="absolute top-6 right-6 p-2 hover:bg-mm-gbg rounded-full transition-colors z-10"
              >
                <XCircle className="w-6 h-6 text-mm-txs" />
              </button>

              <h2 className="text-3xl font-fraunces text-mm-g mb-6">Nuevo Medio de Pago</h2>

              <form onSubmit={handleSave} className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-mm-txs ml-1">Tipo de Pago</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as 'card' | 'cash' })}
                    className="px-4 py-2.5 rounded-xl border-1.5 border-mm-crd bg-white focus:border-mm-g outline-none transition-all text-sm"
                  >
                    <option value="card">Tarjeta de Crédito / Débito</option>
                    <option value="cash">Efectivo (Contra entrega)</option>
                  </select>
                </div>

                <Input
                  label="Nombre / Etiqueta"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="Ej: Mi Visa, Personal, Efectivo"
                  required
                />

                {form.type === 'card' && (
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Número (últimos 4)"
                      value={form.number}
                      onChange={(e) => setForm({ ...form, number: e.target.value })}
                      placeholder="Ej: 4422"
                      maxLength={4}
                      required
                    />
                    <Input
                      label="Vencimiento"
                      value={form.exp}
                      onChange={(e) => setForm({ ...form, exp: e.target.value })}
                      placeholder="Ej: 05/28"
                      required
                    />
                  </div>
                )}

                <div className="flex items-center gap-3 p-4 bg-mm-gbg/10 rounded-2xl border border-mm-crd">
                  <input
                    type="checkbox"
                    id="isPayDefault"
                    checked={form.isDefault}
                    onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                    className="w-5 h-5 rounded border-mm-crd text-mm-g focus:ring-mm-g"
                  />
                  <label htmlFor="isPayDefault" className="text-sm font-bold text-mm-g cursor-pointer">
                    Establecer como medio predeterminado
                  </label>
                </div>

                <div className="pt-4 flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setIsModalOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1">
                    Agregar Medio de Pago
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
