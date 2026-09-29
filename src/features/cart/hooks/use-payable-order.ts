'use client';

import { useEffect, useState } from 'react';
import { useApp } from '@/src/store';
import { hasPayableOrder } from '../services/cart.service';

/**
 * Si el comprador tiene un pedido pendiente de pago. Se consulta solo cuando
 * `enabled` —el carrito abierto y vacío—, que es cuando hace falta explicar a
 * dónde se fueron los productos.
 */
export function usePayableOrder(enabled: boolean): boolean {
  const { state } = useApp();
  const buyerId = state.buyerProfile?.id;
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!enabled || !buyerId) {
      setPending(false);
      return;
    }

    let cancelled = false;
    hasPayableOrder(buyerId)
      .then((value) => {
        if (!cancelled) setPending(value);
      })
      .catch(() => {
        if (!cancelled) setPending(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, buyerId]);

  return pending;
}
