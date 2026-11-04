'use client';

import { useCallback, useEffect, useState } from 'react';
import type { RunnerOrder } from '@/lib/runner/orders';
import { runnerService, type RunnerScope } from '../services/runner.service';

/** Cada cuánto se vuelve a consultar: las tiendas van marcando sus partes listas. */
const REFRESCO_MS = 30_000;

/**
 * Los pedidos del patinador y lo que puede hacer con ellos.
 *
 * Cada acción devuelve el pedido como quedó en el servidor y se reemplaza en la
 * lista: no se adivina el estado siguiente en el navegador.
 */
export function useRunnerOrders() {
  const [scope, setScope] = useState<RunnerScope>('open');
  const [orders, setOrders] = useState<RunnerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Id de la parte o del pedido con una acción en curso. */
  const [busyId, setBusyId] = useState<string | null>(null);
  /** El mensajero no se pudo pedir: se le dice al patinador con qué pedido pasó. */
  const [deliveryError, setDeliveryError] = useState<{ code: string; message: string } | null>(null);

  const fetchOrders = useCallback(
    async (silencioso = false) => {
      try {
        if (!silencioso) setLoading(true);
        setError(null);
        setOrders(await runnerService.list(scope));
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'No se pudieron cargar los pedidos.');
      } finally {
        if (!silencioso) setLoading(false);
      }
    },
    [scope]
  );

  useEffect(() => {
    fetchOrders();
    const timer = setInterval(() => fetchOrders(true), REFRESCO_MS);
    return () => clearInterval(timer);
  }, [fetchOrders]);

  const reemplazar = (order: RunnerOrder) =>
    setOrders((actuales) => actuales.map((o) => (o.orderId === order.orderId ? order : o)));

  const collect = async (storeOrderId: string) => {
    try {
      setBusyId(storeOrderId);
      setError(null);
      reemplazar(await runnerService.collect(storeOrderId));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar la recogida.');
    } finally {
      setBusyId(null);
    }
  };

  const markAtBay = async (orderId: string) => {
    try {
      setBusyId(orderId);
      setError(null);
      setDeliveryError(null);
      const { order, deliveryError: fallo } = await runnerService.markAtBay(orderId);
      reemplazar(order);
      if (fallo) setDeliveryError({ code: order.code, message: fallo });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo marcar el pedido en la bahía.');
    } finally {
      setBusyId(null);
    }
  };

  return {
    scope,
    setScope,
    orders,
    loading,
    error,
    busyId,
    deliveryError,
    dismissDeliveryError: () => setDeliveryError(null),
    collect,
    markAtBay,
    refresh: () => fetchOrders(),
  };
}
