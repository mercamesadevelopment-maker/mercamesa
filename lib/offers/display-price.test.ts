import { describe, expect, it } from 'vitest';
import { displayPrice } from './display-price';

const oferta = { id: 'o', finalPrice: 2400, maxQtyPerOrder: 3 };

describe('displayPrice', () => {
  it('con oferta vigente, el comprador minorista paga el precio de oferta', () => {
    expect(displayPrice({ price_per_unit: 3000, offer: oferta }, 'retail')).toEqual({
      price: 2400,
      listPrice: 3000,
      hasDiscount: true,
      offerId: 'o',
      offerMax: 3,
    });
  });

  it('al mayorista no se le aplica la oferta', () => {
    expect(displayPrice({ price_per_unit: 3000, offer: oferta }, 'wholesale')).toMatchObject({
      price: 3000,
      hasDiscount: false,
      offerId: null,
      offerMax: null,
    });
  });

  it('una oferta que no baja el precio no cuenta como descuento', () => {
    expect(displayPrice({ price_per_unit: 2000, offer: oferta }, 'retail')).toMatchObject({
      price: 2000,
      hasDiscount: false,
      offerMax: null,
    });
  });

  it('sin precio queda en 0', () => {
    expect(displayPrice({ price_per_unit: null }, null).price).toBe(0);
  });
});
