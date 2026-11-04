import { describe, expect, it } from 'vitest';
import { inStorePricing, toStoreOrderRows } from './create-order';

describe('toStoreOrderRows', () => {
  it('las tiendas las deciden los productos; del navegador solo notas y refrigerado', () => {
    const partes = [
      { storeId: 'a', subtotal: 9000 },
      { storeId: 'b', subtotal: 4000 },
    ];
    const declarado = [
      { store_id: 'a', has_refrigerated: true, notes: 'tocar el timbre', subtotal: 1 },
      // Una tienda que el navegador dice pero que no está en los productos no entra.
      { store_id: 'c', notes: 'no va' },
    ];

    expect(toStoreOrderRows(partes, declarado)).toEqual([
      { store_id: 'a', subtotal: 9000, has_refrigerated: true, notes: 'tocar el timbre' },
      { store_id: 'b', subtotal: 4000, has_refrigerated: false, notes: '' },
    ]);
  });
});

describe('inStorePricing', () => {
  it('en mostrador no hay domicilio ni comisiones: se cobra lo de los productos', () => {
    expect(inStorePricing(18000, 20000)).toEqual({
      productsSubtotal: 18000,
      productsListSubtotal: 20000,
      discountTotal: 2000,
      serviceCommission: 0,
      messagesAmount: 0,
      platformCommission: 0,
      deliveryFee: 0,
      total: 18000,
    });
  });
});
