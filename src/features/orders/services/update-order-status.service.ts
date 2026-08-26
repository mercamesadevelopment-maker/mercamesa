import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { OrderStatus } from '@/src/types';

/** Lo que pasó con el domicilio al cambiar el estado, para poder avisarlo. */
export interface DeliveryRequestOutcome {
  requested: boolean;
  /** Mensaje para el vendedor cuando la solicitud no prosperó. */
  error?: string;
}

/**
 * Cambia el estado de un pedido de tienda y lo registra en el histórico.
 *
 * Estaba duplicada byte a byte en los hooks de admin y seller; se centraliza acá
 * para que el disparo del domicilio ocurra una sola vez y no se desincronicen.
 *
 * Devuelve el resultado de la solicitud del domicilio: el cambio de estado nunca
 * se revierte por un fallo de Pibox, pero quien llama debe poder avisarle al
 * vendedor que el mensajero no quedó pedido.
 */
export async function updateStoreOrderStatus(
  storeOrderId: string,
  status: OrderStatus,
  notes?: string
): Promise<DeliveryRequestOutcome> {
  const supabase = createSupabaseBrowserClient();

  const { error: updateError } = await supabase
    .from('store_orders')
    .update({ status })
    .eq('id', storeOrderId);

  if (updateError) throw updateError;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error: historyError } = await supabase
    .from('store_order_status_history')
    .insert({
      store_order_id: storeOrderId,
      status,
      notes: notes || null,
      changed_by: user?.id || null,
    });

  if (historyError) throw historyError;

  // Al marcar "Listo Recogida" el paquete ya existe físicamente: es el momento
  // de pedir el mensajero. Va por el servidor porque el token de Pibox es
  // secreto y no puede viajar al navegador.
  if (status === 'at_collection') {
    return requestPiboxDelivery(storeOrderId, user?.id ?? null);
  }

  return { requested: false };
}

/**
 * Solicita el domicilio.
 *
 * No propaga el error como excepción —revertir el cambio de estado sería peor—,
 * pero tampoco lo esconde: antes solo hacía `console.warn` y el vendedor veía el
 * pedido pasar a "Listo Recogida" sin que existiera ningún mensajero en camino.
 * El motivo queda en el histórico del pedido y se devuelve para mostrarlo.
 */
async function requestPiboxDelivery(
  storeOrderId: string,
  userId: string | null
): Promise<DeliveryRequestOutcome> {
  let message: string;

  try {
    const response = await fetch('/api/pibox/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store_order_id: storeOrderId }),
    });

    if (response.ok) return { requested: true };

    const result = await response.json().catch(() => ({}));

    // 503 es el kill-switch (PIBOX_ENABLED=false): la integración está apagada a
    // propósito, no es una falla que el vendedor deba reportar.
    if (response.status === 503) return { requested: false };

    message = result?.error || `El servicio de domicilios respondió ${response.status}.`;
  } catch (err) {
    message =
      err instanceof Error
        ? `No se pudo contactar el servicio de domicilios: ${err.message}`
        : 'No se pudo contactar el servicio de domicilios.';
  }

  await logDeliveryFailure(storeOrderId, userId, message);

  return { requested: false, error: message };
}

/** Deja el motivo en el histórico del pedido, que es donde se audita. */
async function logDeliveryFailure(
  storeOrderId: string,
  userId: string | null,
  message: string
): Promise<void> {
  try {
    const supabase = createSupabaseBrowserClient();
    await supabase.from('store_order_status_history').insert({
      store_order_id: storeOrderId,
      status: 'at_collection',
      notes: `No se pudo solicitar el domicilio: ${message}`,
      changed_by: userId,
    });
  } catch (err) {
    // Si ni siquiera se puede registrar, no vale la pena tumbar el flujo: el
    // mensaje igual se le devuelve al vendedor.
    console.error('No se pudo registrar el fallo del domicilio en el histórico:', err);
  }
}
