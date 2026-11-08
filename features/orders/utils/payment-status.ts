/**
 * Si el pago de un pedido está aprobado.
 *
 * `paid` se acepta junto a `approved` por los pedidos viejos, igual que en el
 * detalle del pedido: es la misma pregunta y tiene que responderse igual en la
 * lista, en el detalle y al cambiar de estado.
 */
export function isPaymentApproved(paymentStatus: string | null | undefined): boolean {
  return paymentStatus === 'approved' || paymentStatus === 'paid';
}

export const UNPAID_STATUS_CHANGE_WARNING =
  'El pago de este pedido aún no se ha confirmado. Si lo avanzas, se descuenta ' +
  'del inventario y la tienda queda comprometida con un pedido que quizá no se pague. ' +
  'Lo normal es esperar: cuando se apruebe el pago, el pedido pasa solo a «Confirmado».';
