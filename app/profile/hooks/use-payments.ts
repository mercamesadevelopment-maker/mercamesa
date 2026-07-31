'use client';

import { useState, useCallback } from 'react';
import { useApp } from '@/src/store';
import { paymentsService } from '../services/payments.service';
import type { PaymentMethodInsert, PaymentMethodRow } from '../types/payment.types';

export function usePayments() {
  const { dispatch } = useApp();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPaymentMethods = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await paymentsService.getAll();
      setPaymentMethods(data);
      // Sync store so other parts of the app see updated list
      dispatch({
        type: 'UPDATE_BUYER_PROFILE',
        profile: {
          payments: data.map((p) => ({
            id: p.id,
            type: p.type as 'card' | 'nequi' | 'daviplata',
            label: p.label,
            brand: p.brand ?? undefined,
            last4: p.last4 ?? undefined,
            exp: p.exp ?? undefined,
            isDefault: p.is_default,
          })),
        },
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando medios de pago');
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  const updatePaymentMethod = useCallback(
    async (id: string, form: Partial<PaymentMethodInsert>) => {
      setLoading(true);
      setError(null);
      try {
        const updated = await paymentsService.update(id, form);
        setPaymentMethods((prev) => {
          let list = prev;
          if (form.is_default) {
            list = prev.map((p) => ({ ...p, is_default: p.id === id }));
          }
          return list.map((p) => (p.id === id ? updated : p));
        });
        return updated;
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Error actualizando medio de pago');
        throw e;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const deletePaymentMethod = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await paymentsService.remove(id);
      setPaymentMethods((prev) => prev.filter((p) => p.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error eliminando medio de pago');
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    paymentMethods,
    loading,
    error,
    fetchPaymentMethods,
    updatePaymentMethod,
    deletePaymentMethod,
  };
}
