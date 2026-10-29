import type { CartItem } from '@/features/cart/types/cart.types';
import type { Product } from '@/features/products/types/product.types';

export interface CartState {
  items: CartItem[];
  /** Aviso al intentar juntar tiendas que no despachan desde el mismo punto. */
  conflict: { currentStoreName: string } | null;
}

export type CartAction =
  | { type: 'ADD_TO_CART'; product: Product; qty?: number }
  | { type: 'REMOVE_FROM_CART'; productId: number | string }
  | { type: 'UPDATE_CART_QTY'; productId: number | string; qty: number }
  | { type: 'UPDATE_CART_ITEM_NOTES'; productId: number | string; notes: string }
  | { type: 'CLEAR_CART' }
  | { type: 'HYDRATE_CART'; cart: CartItem[] }
  | { type: 'SET_CART_STORE_CONFLICT'; currentStoreName: string }
  | { type: 'CLEAR_CART_STORE_CONFLICT' };

export const EMPTY_CART: CartState = { items: [], conflict: null };

/** La canasta en el navegador. La base es la fuente: esto es la copia optimista. */
export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_TO_CART': {
      const qty = action.qty ?? 1;
      const existing = state.items.find((i) => i.id === action.product.id);
      const items = existing
        ? state.items.map((i) => (i.id === action.product.id ? { ...i, qty: i.qty + qty } : i))
        : [...state.items, { ...action.product, qty }];
      return { ...state, items };
    }
    case 'REMOVE_FROM_CART':
      return { ...state, items: state.items.filter((i) => i.id !== action.productId) };
    case 'UPDATE_CART_QTY':
      return {
        ...state,
        items: state.items
          .map((i) => (i.id === action.productId ? { ...i, qty: Math.max(0, action.qty) } : i))
          .filter((i) => i.qty > 0),
      };
    case 'UPDATE_CART_ITEM_NOTES':
      return {
        ...state,
        items: state.items.map((i) => (i.id === action.productId ? { ...i, notes: action.notes } : i)),
      };
    case 'CLEAR_CART':
      return { ...state, items: [] };
    case 'HYDRATE_CART':
      return { ...state, items: action.cart };
    case 'SET_CART_STORE_CONFLICT':
      return { ...state, conflict: { currentStoreName: action.currentStoreName } };
    case 'CLEAR_CART_STORE_CONFLICT':
      return { ...state, conflict: null };
    default:
      return state;
  }
}
