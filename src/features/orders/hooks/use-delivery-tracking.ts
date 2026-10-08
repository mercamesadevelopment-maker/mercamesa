'use client';

import { useCallback, useEffect, useState } from 'react';
import type { DeliveryStage, DeliveryView, DeliveryViewer } from '@/lib/pibox/delivery-view';

/** Cómo se identifica el pedido: la tienda y el admin tienen el id de la parte; el comprador, el pedido y la tienda. */
export type DeliveryTarget =
  | { storeOrderId: string }
  | { orderId: string; storeId: string };

interface DeliveryTrackingData {
  viewer: DeliveryViewer;
  delivery: DeliveryView | null;
  history?: DeliveryView[];
}

/** Etapas en las que el domicilio sigue moviéndose y vale la pena volver a consultar. */
const LIVE_STAGES: DeliveryStage[] = ['searching', 'assigned', 'picking_up', 'on_the_way'];
const POLL_MS = 30_000;

/**
 * El domicilio de Pibox de un pedido, para mostrarlo en el detalle.
 *
 * Se vuelve a consultar cada 30 s mientras el mensajero está en camino. Los
 * cambios llegan a la base por el webhook de Pibox (y el cron cada 10 min), así
 * que esto solo lee lo que ya está guardado: no le pega a Pibox.
 */
export function useDeliveryTracking(target: DeliveryTarget | null, enabled: boolean) {
  const [data, setData] = useState<DeliveryTrackingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

  const query = !target
    ? null
    : 'storeOrderId' in target
      ? `store_order_id=${encodeURIComponent(target.storeOrderId)}`
      : `order_id=${encodeURIComponent(target.orderId)}&store_id=${encodeURIComponent(target.storeId)}`;

  const load = useCallback(async () => {
    if (!query) return;
    try {
      const res = await fetch(`/api/pibox/bookings?${query}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo consultar el domicilio.');
      setData(json.data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo consultar el domicilio.');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    if (!enabled || !query) return;
    setLoading(true);
    load();
  }, [enabled, query, load]);

  const live = !!data?.delivery && LIVE_STAGES.includes(data.delivery.stage);

  useEffect(() => {
    if (!enabled || !live) return;
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [enabled, live, load]);

  /** «Solicitar otro domiciliario», cuando el anterior se cerró sin entregar. */
  const requestAnother = useCallback(
    async (storeOrderId: string) => {
      setRequesting(true);
      try {
        const res = await fetch('/api/pibox/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ store_order_id: storeOrderId }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'No se pudo solicitar el domiciliario.');
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo solicitar el domiciliario.');
      } finally {
        setRequesting(false);
      }
    },
    [load]
  );

  return { data, loading, error, requesting, reload: load, requestAnother };
}
