/**
 * Cálculo del precio de un pedido. Función pura: no toca red ni base de datos,
 * igual que `buildBookingPayload` en lib/pibox.
 *
 * Es el único lugar donde vive la fórmula. La usan la cotización del carrito
 * (`/api/checkout/quote`) y la creación de la orden (`/api/orders`), que antes
 * calculaban el precio por separado y podían discrepar.
 *
 * El modelo lo definió el cliente en la hoja "MOMENTO 1":
 *
 *   productos                                    50.000
 *   + comisión de servicio 2,99%                  1.495
 *   + mensajes (6 × $120)                           720
 *   = VALOR NETO DE COMPRA                       52.215
 *   + comisión de plataforma 15% (sobre el neto)  7.832
 *   + domicilio (valor real de Pibox)            11.161
 *   = TOTAL A PAGAR                              71.208
 *
 * Ojo con el orden: las comisiones se componen. El 15% se aplica sobre un neto
 * que YA incluye el 2,99% y los mensajes, no sobre el valor de los productos.
 */

export interface PricingSettings {
  /** 0.0299 = 2,99% */
  serviceCommissionRate: number;
  messageUnitPrice: number;
  messagesPerOrder: number;
  /** 0.15 = 15% */
  platformCommissionRate: number;
}

export interface OrderPricing {
  /** Lo que reciben los tenderos: el 100% del valor de sus productos. */
  productsSubtotal: number;
  /**
   * Lo mismo, pero a precio de lista. Igual a `productsSubtotal` cuando no hay
   * ofertas; existe solo para poder mostrarle al comprador cuánto se ahorró.
   */
  productsListSubtotal: number;
  /** `productsListSubtotal - productsSubtotal`. Nunca negativo. */
  discountTotal: number;
  serviceCommission: number;
  messagesAmount: number;
  /** productos + comisión de servicio + mensajes. Base del 15%. */
  netPurchase: number;
  platformCommission: number;
  deliveryFee: number;
  total: number;
}

/**
 * Redondeo al peso. El Excel del cliente trabaja en pesos enteros: 52.215 × 15%
 * son 7.832,25 y en la hoja aparece 7.832. Sin redondear acá, el total no
 * cuadraría contra el suyo y la factura de Siigo se rechazaría por centavos.
 */
function toPesos(value: number): number {
  return Math.round(value);
}

/**
 * `productsListSubtotal` se omite cuando no hay ofertas de por medio: vale lo
 * mismo que el subtotal y obligar a repetirlo en cada llamada solo daría ocasión
 * de equivocarse.
 *
 * Ojo con el orden: el descuento entra por `productsSubtotal`, así que las dos
 * comisiones y el total se calculan sobre el valor YA rebajado. Es lo correcto
 * —la plataforma cobra sobre lo que de verdad se vende— y es lo que hace que el
 * ahorro que ve el comprador sea el que se le descuenta.
 */
export function computeOrderPricing(
  productsSubtotal: number,
  deliveryFee: number,
  settings: PricingSettings,
  productsListSubtotal: number = productsSubtotal
): OrderPricing {
  const serviceCommission = toPesos(productsSubtotal * settings.serviceCommissionRate);
  const messagesAmount = toPesos(settings.messagesPerOrder * settings.messageUnitPrice);

  const netPurchase = productsSubtotal + serviceCommission + messagesAmount;
  const platformCommission = toPesos(netPurchase * settings.platformCommissionRate);

  return {
    productsSubtotal,
    productsListSubtotal,
    discountTotal: Math.max(0, productsListSubtotal - productsSubtotal),
    serviceCommission,
    messagesAmount,
    netPurchase,
    platformCommission,
    deliveryFee,
    total: netPurchase + platformCommission + deliveryFee,
  };
}
