import { describe, expect, it } from 'vitest';
import { toStoreOrderCard } from './store-order-card';

const pedido = { code: 'MM-2026-000100', fulfillment: 'consolidated', payment_status: 'approved' };

const parte = (id: string, storeId: string, split: number) => ({
  id,
  order_id: 'pedido-1',
  store_id: storeId,
  code: `MM-2026-000100-${split}`,
  status: 'confirmed',
  subtotal: 5000,
  orders: pedido,
});

const items = [
  { id: 'i-a', order_id: 'pedido-1', catalog_name: 'Tomate', quantity: 1, unit_price: 5000, store_products: { store_id: 'tienda-a' } },
  { id: 'i-b', order_id: 'pedido-1', catalog_name: 'Papa', quantity: 2, unit_price: 2500, store_products: { store_id: 'tienda-b' } },
];

describe('toStoreOrderCard', () => {
  it('las dos partes de un pedido de varias tiendas son tarjetas distintas', () => {
    const a = toStoreOrderCard(parte('parte-a', 'tienda-a', 1), items);
    const b = toStoreOrderCard(parte('parte-b', 'tienda-b', 2), items);

    // Antes las dos tenían el id del pedido, y una acción sobre la B caía en la A.
    expect(a.id).not.toBe(b.id);
    expect(a.id).toBe('parte-a');
    expect(b.storeOrderId).toBe('parte-b');
  });

  it('cada tarjeta lleva solo los productos de su tienda', () => {
    const a = toStoreOrderCard(parte('parte-a', 'tienda-a', 1), items);
    const b = toStoreOrderCard(parte('parte-b', 'tienda-b', 2), items);

    expect(a.items.map((i) => i.name)).toEqual(['Tomate']);
    expect(b.items.map((i) => i.name)).toEqual(['Papa']);
  });

  it('marca el pedido como de varias tiendas', () => {
    expect(toStoreOrderCard(parte('parte-a', 'tienda-a', 1), items).fulfillment).toBe('consolidated');
  });
});
