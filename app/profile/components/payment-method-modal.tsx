'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { usePayments } from '../hooks/use-payments';
import type { PaymentMethodFormValues } from '../types/payment.types';
import { Button, Input } from '@/src/components/Shared';
import { XCircle, Loader2 } from 'lucide-react';

const EMPTY_FORM: PaymentMethodFormValues = {
  label: '',
  last4: '',
  exp: '',
  is_default: false,
};

export function PaymentMethodModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const { createPaymentMethod } = usePayments();
  const [form, setForm] = useState<PaymentMethodFormValues>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const field = (key: keyof PaymentMethodFormValues) => ({
    value: form[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value })),
  });

  const handleClose = () => {
    if (submitting) return;
    setForm(EMPTY_FORM);
    setFormError(null);
    onClose();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await createPaymentMethod({
        type: 'card',
        label: form.label,
        last4: form.last4,
        exp: form.exp,
        is_default: form.is_default,
      });
      setForm(EMPTY_FORM);
      onCreated?.();
      onClose();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-mm-g/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-white rounded-[40px] shadow-2xl overflow-hidden max-w-lg w-full p-10"
          >
            <button
              onClick={handleClose}
              disabled={submitting}
              className="absolute top-6 right-6 p-2 hover:bg-mm-gbg rounded-full transition-colors z-10 disabled:opacity-40"
            >
              <XCircle className="w-6 h-6 text-mm-txs" />
            </button>

            <h2 className="text-3xl font-fraunces text-mm-g mb-6">Nueva Tarjeta</h2>

            <form onSubmit={handleSave} className="space-y-4">
              <Input
                label="Nombre / Etiqueta"
                {...field('label')}
                placeholder="Ej: Mi Visa, Personal"
                required
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Número (últimos 4)"
                  {...field('last4')}
                  placeholder="Ej: 4422"
                  maxLength={4}
                  required
                />
                <Input label="Vencimiento" {...field('exp')} placeholder="Ej: 05/28" required />
              </div>

              <div className="flex items-center gap-3 p-4 bg-mm-gbg/10 rounded-2xl border border-mm-crd">
                <input
                  type="checkbox"
                  id="isPayDefault"
                  checked={form.is_default}
                  onChange={(e) => setForm((prev) => ({ ...prev, is_default: e.target.checked }))}
                  className="w-5 h-5 rounded border-mm-crd text-mm-g focus:ring-mm-g"
                />
                <label htmlFor="isPayDefault" className="text-sm font-bold text-mm-g cursor-pointer">
                  Establecer como medio predeterminado
                </label>
              </div>

              {formError && (
                <p className="text-sm text-r font-medium bg-rl px-4 py-2 rounded-xl">{formError}</p>
              )}

              <div className="pt-4 flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={handleClose} disabled={submitting}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1 flex items-center justify-center gap-2" disabled={submitting}>
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Agregar Medio de Pago
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
