import { describe, expect, it } from 'vitest';
import type { Product } from '@/src/types';
import { EMPTY_CART, cartReducer } from './cart-reducer';

const tomate = { id: 'p1', storeId: 's1', name: 'Tomate', retailPrice: 3000 } as Product;

describe('cartReducer', () => {
  it('agregar dos veces suma la cantidad en vez de repetir el producto', () => {
    let s = cartReducer(EMPTY_CART, { type: 'ADD_TO_CART', product: tomate, qty: 2 });
    s = cartReducer(s, { type: 'ADD_TO_CART', product: tomate });
    expect(s.items).toHaveLength(1);
    expect(s.items[0].qty).toBe(3);
  });

  it('bajar la cantidad a cero lo saca de la canasta', () => {
    const s = cartReducer(cartReducer(EMPTY_CART, { type: 'ADD_TO_CART', product: tomate }), {
      type: 'UPDATE_CART_QTY',
      productId: 'p1',
      qty: 0,
    });
    expect(s.items).toEqual([]);
  });

  it('vaciar la canasta no borra el aviso de tiendas incompatibles', () => {
    let s = cartReducer(EMPTY_CART, { type: 'SET_CART_STORE_CONFLICT', currentStoreName: 'La Esquina' });
    s = cartReducer(s, { type: 'CLEAR_CART' });
    expect(s.conflict).toEqual({ currentStoreName: 'La Esquina' });
    expect(cartReducer(s, { type: 'CLEAR_CART_STORE_CONFLICT' }).conflict).toBeNull();
  });
});
