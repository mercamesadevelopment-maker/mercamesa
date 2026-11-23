import { OrderStatus } from '@/features/orders/types/order.types';

/**
 * Regresa un pedido de tienda a un estado por el que ya pasó (casos extremos).
 *
 * Va por el servidor (`POST /api/store-orders/[id]/revert`): si ya se pidió el
 * mensajero y el paquete deja de estar listo, lo cancela en Pibox antes de
 * regresar el estado. Antes se llamaba la función de la base desde el navegador y
 * el mensajero seguía en camino (MM-2026-001100).
 *
 * Las reglas —observación obligatoria, destino presente en el historial, quién
 * puede hacerlo, pedido no liquidado— las sigue validando
 * `revert_store_order_status` en la base. A diferencia de
 * `updateStoreOrderStatus`, no solicita domicilio: una corrección no debe pedir
 * otro mensajero.
 */
export async function revertStoreOrderStatus(
  storeOrderId: string,
  targetStatus: OrderStatus,
  notes: string
): Promise<void> {
  const res = await fetch(`/api/store-orders/${storeOrderId}/revert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target: targetStatus, notes }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? 'No se pudo regresar el estado del pedido.');
  }
}
