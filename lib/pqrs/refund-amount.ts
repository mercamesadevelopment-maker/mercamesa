/**
 * Cuánto se le devuelve al comprador. Función pura: no toca red ni base.
 *
 * Es el único lugar donde vive la cuenta. La usan la vista previa del caso (lo
 * que la tienda y el admin ven antes de decidir) y la aprobación (lo que de
 * verdad se acredita), así que no pueden discrepar.
 *
 * La regla, decidida con el cliente:
 *
 *   producto dañado                                10.000
 *   + su parte de la comisión de servicio (2,99%)     299
 *   + su parte del servicio MercaMesa (15%)         1.545
 *   = SALDO A FAVOR                                 11.844
 *
 * El comprador recupera lo que pagó por ese producto. Los mensajes y el
 * domicilio no entran: se cobraron por el pedido, no por el producto, y el
 * pedido sí llegó. Solo se devuelven cuando falla el pedido completo.
 *
 * Las tasas no se leen de la parametrización de hoy sino de lo que el propio
 * pedido cobró: si mañana cambia la comisión, la devolución de un pedido viejo
 * sigue saliendo con la suya.
 */

export interface OrderMoney {
  /** Valor de los productos. */
  subtotal: number;
  serviceCommission: number;
  messagesAmount: number;
  platformCommission: number;
  deliveryFee: number;
  total: number;
}

export interface RefundLine {
  orderItemId: string;
  quantity: number;
  unitPrice: number;
}

export type RefundScope = 'items' | 'order';

export interface RefundBreakdown {
  scope: RefundScope;
  products: number;
  serviceCommission: number;
  platformCommission: number;
  messages: number;
  delivery: number;
  total: number;
  items: { orderItemId: string; quantity: number; amount: number }[];
}

/** Al peso, como todo el modelo de precios (ver `computeOrderPricing`). */
function toPesos(value: number): number {
  return Math.round(value);
}

/**
 * `lines` son las líneas que se devuelven con su cantidad. Para el pedido
 * completo son todas las del pedido, enteras: así quedan registradas y un
 * reclamo posterior por uno de esos productos no se paga dos veces.
 */
export function computeRefund(order: OrderMoney, lines: RefundLine[], scope: RefundScope): RefundBreakdown {
  const items = lines.map((l) => ({
    orderItemId: l.orderItemId,
    quantity: l.quantity,
    amount: toPesos(l.unitPrice * l.quantity),
  }));

  if (scope === 'order') {
    return {
      scope,
      products: order.subtotal,
      serviceCommission: order.serviceCommission,
      platformCommission: order.platformCommission,
      messages: order.messagesAmount,
      delivery: order.deliveryFee,
      total: order.total,
      items,
    };
  }

  // Nunca más que el valor de los productos del pedido, aunque una cantidad mal
  // digitada sume de más.
  const products = Math.min(
    items.reduce((sum, i) => sum + i.amount, 0),
    order.subtotal
  );

  const netPurchase = order.subtotal + order.serviceCommission + order.messagesAmount;

  const serviceCommission =
    order.subtotal > 0 ? toPesos((products * order.serviceCommission) / order.subtotal) : 0;
  const platformCommission =
    netPurchase > 0 ? toPesos(((products + serviceCommission) * order.platformCommission) / netPurchase) : 0;

  return {
    scope,
    products,
    serviceCommission,
    platformCommission,
    messages: 0,
    delivery: 0,
    total: products + serviceCommission + platformCommission,
    items,
  };
}

/**
 * Cuánto se devuelve cuando una tienda cancela su parte de un pedido ya pagado.
 *
 * Es la misma cuenta de un producto dañado, sobre todos los productos de esa
 * tienda: su valor y la parte de las comisiones que se cobró por ellos. El
 * domicilio y los mensajes no entran, porque el resto del pedido sí sale.
 *
 * Salvo que sea la última parte que quedaba (`lastActivePart`): ahí ya no sale
 * nada, así que se devuelve todo lo que falte por devolver del pedido —domicilio
 * y mensajes incluidos—, ni un peso más ni uno menos. `alreadyRefunded` es lo
 * devuelto antes por este pedido.
 */
export function computeCancellationRefund(
  order: OrderMoney,
  lines: RefundLine[],
  options: { lastActivePart: boolean; alreadyRefunded: number }
): RefundBreakdown {
  const parte = computeRefund(order, lines, 'items');
  if (!options.lastActivePart) return parte;

  const restante = Math.max(0, order.total - options.alreadyRefunded);
  const messages = order.messagesAmount;
  const delivery = order.deliveryFee;

  // Lo que no sea productos, mensajes ni domicilio son comisiones. El ajuste por
  // los redondeos de las devoluciones anteriores cae en la de plataforma, que es
  // la de MercaMesa.
  const comisiones = Math.max(0, restante - parte.products - messages - delivery);
  const serviceCommission = Math.min(parte.serviceCommission, comisiones);

  return {
    scope: 'order',
    products: parte.products,
    serviceCommission,
    platformCommission: comisiones - serviceCommission,
    messages,
    delivery,
    total: parte.products + comisiones + messages + delivery,
    items: parte.items,
  };
}
