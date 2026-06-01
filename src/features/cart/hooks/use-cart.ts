'use client';

import { useApp } from '@/src/store';
import { Product } from '@/src/types';
import {
  addToCartDb,
  updateCartQtyDb,
  removeFromCartDb,
  clearCartDb,
  fetchCart,
} from '../services/cart.service';

export function useCart() {
  const { state, dispatch } = useApp();
  const buyerId = state.buyerProfile?.id;

  const addToCart = async (product: Product, qty: number = 1) => {
    if (!state.isLoggedIn || !buyerId) {
      alert('Debes iniciar sesión para añadir productos al carrito');
      return;
    }

    // Optimistic update
    dispatch({ type: 'ADD_TO_CART', product, qty });

    try {
      // Get current quantity in the state cart
      const existing = state.cart.find((i) => i.id === product.id);
      const newQty = existing ? existing.qty + qty : qty;
      await addToCartDb(buyerId, String(product.id), newQty);
    } catch (e) {
      console.error('Error adding to cart in DB:', e);
    }
  };

  const updateCartQty = async (productId: number, qty: number) => {
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

  const removeFromCart = async (productId: number) => {
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
    removeFromCart,
    clearCart,
    syncCart,
  };
}
