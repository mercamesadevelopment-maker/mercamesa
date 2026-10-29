'use client';

import { useSession } from '@/features/auth/session-context';
import { useCartState } from '@/features/cart/cart-context';
import { Product } from '@/features/products/types/product.types';
import {
  addToCartDb,
  updateCartQtyDb,
  removeFromCartDb,
  clearCartDb,
  fetchCart,
  fetchPickupGroup,
  updateCartItemNotesDb,
} from '../services/cart.service';
import { sharePickupPoint } from '@/lib/orders/pickup-group';

export function useCart() {
  const session = useSession();
  const cartState = useCartState();
  const buyerId = session.profile?.id;

  const addToCart = async (product: Product, qty: number = 1, offerId?: string | null) => {
    if (!session.isLoggedIn || !buyerId) {
      alert('Debes iniciar sesión para añadir productos al carrito');
      return;
    }

    // Un pedido puede llevar varias tiendas, pero solo las que despachan desde
    // el mismo punto: de ahí sale un solo domicilio. Si la tienda ya está en la
    // canasta no hay nada que preguntar; si es nueva, se compara su punto de
    // recogida con el de lo que ya hay (toda la canasta comparte uno).
    const yaEnLaCanasta = cartState.items.some((i) => String(i.storeId) === String(product.storeId));
    if (cartState.items.length > 0 && !yaEnLaCanasta) {
      const currentItem = cartState.items[0];
      const [nuevo, actual] = await Promise.all([
        fetchPickupGroup(String(product.storeId)),
        fetchPickupGroup(String(currentItem.storeId)),
      ]);

      if (!sharePickupPoint([actual, nuevo])) {
        cartState.dispatch({
          type: 'SET_CART_STORE_CONFLICT',
          currentStoreName: currentItem.storeName || 'la tienda actual',
        });
        return;
      }
    }

    // Optimistic update
    cartState.dispatch({ type: 'ADD_TO_CART', product, qty });

    try {
      // Se manda `qty`, no la cantidad acumulada.
      //
      // Antes se sumaba acá `existing.qty + qty` y se pasaba el total a
      // `addToCartDb`, que a su vez vuelve a sumar sobre lo que ya hay en la
      // tabla. Con dos clics seguidos la base quedaba con más cantidad que la
      // pantalla, porque además `cartState.items` es el valor previo al dispatch.
      await addToCartDb(buyerId, String(product.id), qty, offerId);
    } catch (e) {
      console.error('Error adding to cart in DB:', e);
    }
  };

  const updateCartQty = async (productId: number | string, qty: number) => {
    if (!session.isLoggedIn || !buyerId) return;

    // Optimistic update
    cartState.dispatch({ type: 'UPDATE_CART_QTY', productId, qty });

    try {
      if (qty <= 0) {
        await removeFromCartDb(buyerId, String(productId));
      } else {
        await updateCartQtyDb(buyerId, String(productId), qty);
      }
    } catch (e) {
      console.error('Error updating cart qty in DB:', e);
    }
  };

  const updateCartItemNotes = async (productId: number | string, notes: string) => {
    if (!session.isLoggedIn || !buyerId) return;

    // Optimistic update
    cartState.dispatch({ type: 'UPDATE_CART_ITEM_NOTES', productId, notes });

    try {
      await updateCartItemNotesDb(buyerId, String(productId), notes);
    } catch (e) {
      console.error('Error updating cart item notes in DB:', e);
    }
  };

  const removeFromCart = async (productId: number | string) => {
    if (!session.isLoggedIn || !buyerId) return;

    // Optimistic update
    cartState.dispatch({ type: 'REMOVE_FROM_CART', productId });

    try {
      await removeFromCartDb(buyerId, String(productId));
    } catch (e) {
      console.error('Error removing from cart in DB:', e);
    }
  };

  const clearCart = async () => {
    if (!session.isLoggedIn || !buyerId) return;

    // Optimistic update
    cartState.dispatch({ type: 'CLEAR_CART' });

    try {
      await clearCartDb(buyerId);
    } catch (e) {
      console.error('Error clearing cart in DB:', e);
    }
  };

  const syncCart = async () => {
    if (!session.isLoggedIn || !buyerId) return;

    try {
      const items = await fetchCart(buyerId);
      cartState.dispatch({ type: 'HYDRATE_CART', cart: items });
    } catch (e) {
      console.error('Error syncing cart from DB:', e);
    }
  };

  return {
    cart: cartState.items,
    addToCart,
    updateCartQty,
    updateCartItemNotes,
    removeFromCart,
    clearCart,
    syncCart,
  };
}
