import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { OrderStatus } from '@/src/types';

/**
 * Cambia el estado de un pedido de tienda y lo registra en el histórico.
 *
 * Estaba duplicada byte a byte en los hooks de admin y seller; se centraliza acá
 * para que el disparo del domicilio ocurra una sola vez y no se desincronicen.
 */
export async function updateStoreOrderStatus(
  storeOrderId: string,
  status: OrderStatus,
  notes?: string
): Promise<void> {
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
    await requestPiboxDelivery(storeOrderId);
  }
}

/**
 * Solicita el domicilio. Deliberadamente NO propaga el error: si Pibox falla o
 * está desactivado, el cambio de estado ya quedó guardado y el domicilio se
 * puede solicitar después a mano. Revertir el estado sería peor.
 */
async function requestPiboxDelivery(storeOrderId: string): Promise<void> {
  try {
    const response = await fetch('/api/pibox/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store_order_id: storeOrderId }),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      console.warn(
        `No se pudo solicitar el domicilio a Pibox (${response.status}):`,
        result?.error || 'error desconocido'
      );
    }
  } catch (err) {
    console.warn('No se pudo contactar el servicio de domicilios:', err);
  }
}
