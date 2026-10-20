/**
 * Avance del estado de la parte de una tienda, el que hacen el tendero y el
 * admin con el botón del pedido.
 *
 * Es el mismo orden que muestra el panel (`next` en
 * `src/features/orders/utils/order-status.ts`): un paso a la vez, solo hacia
 * adelante. Regresar a un estado anterior va por `revert_store_order_status`, y
 * cancelar por `/api/store-orders/[id]/cancel`, que abona al comprador.
 *
 * Antes el navegador escribía el estado que quisiera en `store_orders`, sin
 * ninguna regla: se podía pasar de «pendiente» a «entregado», o revivir una
 * parte cancelada.
 */
export const NEXT_STATUS = {
  pending: 'confirmed',
  confirmed: 'packing',
  paid: 'packing',
  packing: 'at_collection',
  at_collection: 'dispatched',
  dispatched: 'delivered',
} as const;

export type AdvanceableStatus = keyof typeof NEXT_STATUS;

export type TransitionCheck =
  | { kind: 'advance' }
  /** Ya está en ese estado: no se vuelve a escribir (un doble clic, un reintento). */
  | { kind: 'same' }
  | { kind: 'invalid'; reason: string };

export function checkTransition(current: string, target: string): TransitionCheck {
  if (current === target) return { kind: 'same' };
  const next = NEXT_STATUS[current as AdvanceableStatus];
  if (!next) return { kind: 'invalid', reason: 'Este pedido ya no cambia de estado.' };
  if (next !== target) {
    return { kind: 'invalid', reason: 'El pedido solo puede avanzar al siguiente paso.' };
  }
  return { kind: 'advance' };
}
