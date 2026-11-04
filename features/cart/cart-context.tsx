'use client';

import React, { createContext, useContext, useEffect, useMemo, useReducer, ReactNode } from 'react';
import { useSession } from '@/features/auth/session-context';
import { fetchCart, recoverAbandonedCartDb } from './services/cart.service';
import { EMPTY_CART, cartReducer, type CartAction, type CartState } from './utils/cart-reducer';

type CartContextValue = CartState & { dispatch: React.Dispatch<CartAction> };

const CartContext = createContext<CartContextValue | undefined>(undefined);

/** La canasta de quien tiene la sesión. Se carga de la base al entrar y se vacía al salir. */
export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, EMPTY_CART);
  const { isLoggedIn, profile } = useSession();
  const userId = isLoggedIn ? profile.id : '';

  useEffect(() => {
    if (!userId) {
      dispatch({ type: 'CLEAR_CART' });
      return;
    }

    let cancelado = false;
    (async () => {
      try {
        // La página de estado de pago resuelve ella misma los ítems de su
        // orden; hacerlo también acá los revertiría justo antes de que ella
        // los borre.
        if (!window.location.pathname.includes('/orders/payment-status')) {
          try {
            // Rescata los ítems que quedaron en `pending` porque el comprador
            // abandonó el pago. No depende de sessionStorage, así que funciona
            // aunque haya vuelto desde otra pestaña o al día siguiente.
            await recoverAbandonedCartDb(userId);
          } catch (e) {
            console.error('Error recuperando el carrito abandonado:', e);
          }
        }
        const cart = await fetchCart(userId);
        if (!cancelado) dispatch({ type: 'HYDRATE_CART', cart });
      } catch (e) {
        console.error('Error loading cart from DB during hydration:', e);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [userId]);

  const value = useMemo(() => ({ ...state, dispatch }), [state]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/** El estado crudo de la canasta. Para agregar o quitar productos, `useCart()`, que también escribe en la base. */
export function useCartState(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCartState must be used within CartProvider');
  return context;
}
