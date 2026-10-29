'use client';

import { useCallback, useEffect, useState } from 'react';
import type { LogisticsOrder } from '@/lib/logistics/orders';
import { logisticsService, type LogisticsScope } from '../services/logistics.service';

/** Cada cuánto se vuelve a consultar: van llegando partes y mensajeros. */
const REFRESCO_MS = 30_000;

/**
 * Los pedidos de la bahía y lo que logística puede hacer con ellos. Cada acción
 * devuelve el pedido como quedó en el servidor y se reemplaza en la lista.
 */
export function useLogisticsOrders() {
  const [scope, setScope] = useState<LogisticsScope>('open');
  const [orders, setOrders] = useState<LogisticsOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deliveryError, setDeliveryError] = useState<{ code: string; message: string } | null>(null);

  const fetchOrders = useCallback(
    async (silencioso = false) => {
      try {
        if (!silencioso) setLoading(true);
        setError(null);
        setOrders(await logisticsService.list(scope));
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

  const reemplazar = (order: LogisticsOrder) =>
    setOrders((actuales) => actuales.map((o) => (o.orderId === order.orderId ? order : o)));

  const receive = async (storeOrderId: string) => {
    try {
      setBusyId(storeOrderId);
      setError(null);
      const { order, deliveryError: fallo } = await logisticsService.receive(storeOrderId);
      reemplazar(order);
      if (fallo) setDeliveryError({ code: order.code, message: fallo });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar la recepción.');
    } finally {
      setBusyId(null);
    }
  };

  const dispatch = async (orderId: string) => {
    try {
      setBusyId(orderId);
      setError(null);
      reemplazar(await logisticsService.dispatch(orderId));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo marcar el pedido en camino.');
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
    receive,
    dispatch,
    refresh: () => fetchOrders(),
  };
}
