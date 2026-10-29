import { describe, expect, it } from 'vitest';
import type { CartItem } from '@/features/cart/types/cart.types';
import { cartSavings, discountPct } from './cart-savings';

const item = (over: Partial<CartItem>): CartItem => ({ qty: 1, ...over }) as CartItem;

describe('discountPct', () => {
  it('redondea el porcentaje', () => {
    expect(discountPct(3000, 2000)).toBe(33);
    expect(discountPct(10000, 7500)).toBe(25);
  });

  it('es 0 si el precio no bajó o no hay precio de lista', () => {
    expect(discountPct(5000, 5000)).toBe(0);
    expect(discountPct(5000, 6000)).toBe(0);
    expect(discountPct(0, 1000)).toBe(0);
  });
});

describe('cartSavings', () => {
  it('suma solo las líneas con descuento, por la cantidad', () => {
    const items = [
      item({ listPrice: 5000, qty: 2 }), // ahorra 1000 x 2
      item({ listPrice: 3000, qty: 1 }), // sin oferta
      item({ qty: 4 }), // sin precio de lista
    ];
    const prices = [4000, 3000, 2500];
    const r = cartSavings(items, (i) => prices[items.indexOf(i)]);

    expect(r.total).toBe(2000);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0]).toMatchObject({ price: 4000, listPrice: 5000, savings: 2000 });
  });

  it('una canasta vacía no ahorra', () => {
    expect(cartSavings([], () => 0)).toEqual({ lines: [], total: 0 });
  });
});
