'use client';

import { useCart } from '@/features/cart/hooks/use-cart';
import { useSession } from '@/features/auth/session-context';
import { displayPrice } from '@/lib/offers/display-price';
import { discountPct } from '@/features/cart/utils/cart-savings';
import { maxQtyFor } from '@/lib/offers/offer-limit';
import type { StoreProduct } from '@/app/products/hooks/usePublicProducts';

/**
 * Un producto de la vitrina frente a la canasta: el precio que paga este
 * comprador, cuánto lleva y hasta cuánto puede llevar, y cómo agregarlo.
 *
 * Lo comparten la tarjeta y la página del producto, para que no puedan mostrar
 * un precio distinto ni agregar con datos distintos.
 */
/** Lo que hace falta de un producto de la vitrina: la tarjeta y la página lo tienen. */
export type CartableProduct = Pick<
  StoreProduct,
  'id' | 'store_id' | 'stock' | 'price_per_unit' | 'offer' | 'catalog_products' | 'stores' | 'measurement_units' | 'imageSignedUrl'
>;

export function useProductCart(product: CartableProduct) {
  const { cart, addToCart, updateCartQty } = useCart();
  const session = useSession();

  const precio = displayPrice(product, session.role);
  const stock = Number(product.stock ?? 0);
  const qty = cart.find((i) => String(i.id) === String(product.id))?.qty ?? 0;

  /** `true` si quedó en la canasta. */
  const add = () =>
    addToCart(
      {
        id: product.id,
        name: product.catalog_products?.name || 'Producto',
        cat: product.catalog_products?.categories?.name || 'Sin Categoría',
        retailPrice: precio.price,
        wsPrice: precio.listPrice,
        // Con descuento, el carrito tacha el de lista y suma el ahorro.
        listPrice: precio.hasDiscount ? precio.listPrice : undefined,
        offerId: precio.offerId,
        offerMaxQty: precio.offerMax,
        stock: product.stock ?? 0,
        unit: product.measurement_units?.abbreviation || 'und',
        emoji: '📦',
        image: product.imageSignedUrl || null,
        plazaId: 1,
        storeId: product.store_id,
        storeName: product.stores?.name || 'Tienda',
      } as any,
      1,
      // Queda guardada en `cart_items`, igual que al agregar desde una oferta.
      precio.offerId
    );

  return {
    ...precio,
    pct: discountPct(precio.listPrice, precio.price),
    stock,
    qty,
    /** Las existencias o, si es menor, el máximo por pedido de la oferta. */
    tope: maxQtyFor(stock, precio.offerMax),
    unit: product.measurement_units?.abbreviation || 'und',
    add,
    setQty: (next: number) => updateCartQty(product.id, next),
  };
}
