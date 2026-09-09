'use client';

import { useApp } from '@/src/store';
import { Product } from '@/src/types';
import {
  addToCartDb,
  updateCartQtyDb,
  removeFromCartDb,
  clearCartDb,
  fetchCart,
  updateCartItemNotesDb,
} from '../services/cart.service';

export function useCart() {
  const { state, dispatch } = useApp();
  const buyerId = state.buyerProfile?.id;

  const addToCart = async (product: Product, qty: number = 1, offerId?: string | null) => {
    if (!state.isLoggedIn || !buyerId) {
      alert('Debes iniciar sesión para añadir productos al carrito');
      return;
    }

    if (state.cart.length > 0) {
      const currentItem = state.cart[0];
      if (String(currentItem.storeId) !== String(product.storeId)) {
        dispatch({
          type: 'SET_CART_STORE_CONFLICT',
          currentStoreName: currentItem.storeName || 'la tienda actual',
        });
        return;
      }
    }

    // Optimistic update
    dispatch({ type: 'ADD_TO_CART', product, qty });

    try {
      // Se manda `qty`, no la cantidad acumulada.
      //
      // Antes se sumaba acá `existing.qty + qty` y se pasaba el total a
      // `addToCartDb`, que a su vez vuelve a sumar sobre lo que ya hay en la
      // tabla. Con dos clics seguidos la base quedaba con más cantidad que la
      // pantalla, porque además `state.cart` es el valor previo al dispatch.
      await addToCartDb(buyerId, String(product.id), qty, offerId);
    } catch (e) {
      console.error('Error adding to cart in DB:', e);
    }
  };

  const updateCartQty = async (productId: number | string, qty: number) => {
    if (!state.isLoggedIn || !buyerId) return;

    // Optimistic update
    dispatch({ type: 'UPDATE_CART_QTY', productId, qty });

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
    if (!state.isLoggedIn || !buyerId) return;

    // Optimistic update
    dispatch({ type: 'UPDATE_CART_ITEM_NOTES', productId, notes });

    try {
      await updateCartItemNotesDb(buyerId, String(productId), notes);
    } catch (e) {
      console.error('Error updating cart item notes in DB:', e);
    }
  };

  const removeFromCart = async (productId: number | string) => {
    if (!state.isLoggedIn || !buyerId) return;

    // Optimistic update
    dispatch({ type: 'REMOVE_FROM_CART', productId });

    try {
      await removeFromCartDb(buyerId, String(productId));
    } catch (e) {
      console.error('Error removing from cart in DB:', e);
    }
  };

  const clearCart = async () => {
    if (!state.isLoggedIn || !buyerId) return;

    // Optimistic update
    dispatch({ type: 'CLEAR_CART' });

    try {
      await clearCartDb(buyerId);
    } catch (e) {
      console.error('Error clearing cart in DB:', e);
    }
  };

  const syncCart = async () => {
    if (!state.isLoggedIn || !buyerId) return;

    try {
      const items = await fetchCart(buyerId);
      dispatch({ type: 'HYDRATE_CART', cart: items });
    } catch (e) {
      console.error('Error syncing cart from DB:', e);
    }
  };

  return {
    cart: state.cart,
    addToCart,
    updateCartQty,
    updateCartItemNotes,
    removeFromCart,
    clearCart,
    syncCart,
  };
}
