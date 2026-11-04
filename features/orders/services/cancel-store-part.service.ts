export interface CancelPartOutcome {
  /** Lo abonado al comprador como saldo a favor. */
  refunded: number;
  /** No quedó ninguna tienda en el pedido: se canceló completo. */
  orderCancelled: boolean;
}

/**
 * La tienda no puede cumplir su parte de un pedido de varias tiendas.
 *
 * Va por el servidor y no como un cambio de estado desde el navegador: además
 * de cancelar hay que devolverle la plata al comprador, y eso no se le puede
 * confiar a quien cancela.
 */
export async function cancelStorePart(storeOrderId: string, reason: string): Promise<CancelPartOutcome> {
  const res = await fetch(`/api/store-orders/${storeOrderId}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? 'No se pudo cancelar esta parte del pedido.');

  return json.data as CancelPartOutcome;
}
