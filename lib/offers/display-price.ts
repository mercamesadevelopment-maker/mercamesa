/**
 * El precio que se le muestra y se le cobra al comprador por un producto de la
 * vitrina, con la oferta vigente que ya resolvió el servidor.
 *
 * Al mayorista no se le aplica la oferta: paga el precio mayorista, que es la
 * misma regla de `resolveOfferPrices` y de la canasta. La usan la tarjeta del
 * producto y su página, para que no puedan mostrar dos precios distintos.
 */
export interface DisplayPrice {
  /** Lo que paga. */
  price: number;
  /** El de lista, tachado cuando hay descuento. */
  listPrice: number;
  hasDiscount: boolean;
  /** La oferta que se aplica, o `null`. */
  offerId: string | null;
  /** El máximo por pedido de esa oferta. Sin descuento no hay máximo que cuidar. */
  offerMax: number | null;
}

export function displayPrice(
  product: {
    price_per_unit: number | null;
    offer?: { id: string; finalPrice: number; maxQtyPerOrder: number | null } | null;
  },
  role: string | null | undefined
): DisplayPrice {
  const listPrice = Number(product.price_per_unit || 0);
  const offer = role === 'wholesale' ? null : product.offer ?? null;
  const hasDiscount = !!offer && offer.finalPrice < listPrice;
  return {
    price: hasDiscount ? offer!.finalPrice : listPrice,
    listPrice,
    hasDiscount,
    offerId: hasDiscount ? offer!.id : null,
    offerMax: hasDiscount ? offer!.maxQtyPerOrder ?? null : null,
  };
}
