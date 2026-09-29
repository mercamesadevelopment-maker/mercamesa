'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  iniciarPagoDeOrden,
  PERFIL_SIN_DOCUMENTO,
  PERFIL_SIN_EMAIL,
} from '@/src/features/payment/services/payment.service';

/** Si un pedido todavía se puede pagar, según `payable_until` de la vista. */
export function isPayable(payableUntil: string | null | undefined): boolean {
  return !!payableUntil && new Date(payableUntil).getTime() > Date.now();
}

/**
 * Reintenta el pago de un pedido pendiente: abre un intento nuevo en ZonaPagos
 * sobre el MISMO pedido y lleva al comprador a la pasarela. Así, si la pasarela
 * no le cargó, no tiene que rehacer el carrito ni deja un pedido duplicado.
 */
export function usePayOrder() {
  const router = useRouter();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async (orderId: string, storeName?: string | null) => {
    setPaying(true);
    setError(null);
    try {
      const url = await iniciarPagoDeOrden(orderId, { storeName: storeName ?? undefined });
      window.location.href = url;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo iniciar el pago.';
      if (message === PERFIL_SIN_DOCUMENTO || message === PERFIL_SIN_EMAIL) {
        router.push('/profile?incomplete=1');
        return;
      }
      setError(message);
      setPaying(false);
    }
  };

  return { pay, paying, error };
}
