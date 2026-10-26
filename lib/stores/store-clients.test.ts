import { describe, expect, it } from 'vitest';
import { groupStoreClients, type ClientOrderPart, type ClientPerson } from './store-clients';

const KELLY = 'tienda-kelly';
const OTRA = 'tienda-otra';
const storeNames = { [KELLY]: 'Salsamentaria, La Kelly', [OTRA]: 'Otra tienda' };

function parte(over: Partial<ClientOrderPart> & { orders: ClientOrderPart['orders'] }): ClientOrderPart {
  return {
    id: `parte-${Math.random()}`,
    order_id: 'pedido-1',
    store_id: KELLY,
    code: 'mm-2026-000001-1',
    subtotal: 10000,
    status: 'pending',
    created_at: '2026-10-08T15:00:00Z',
    ...over,
  };
}

function persona(id: string, nombre: string, over: Partial<ClientPerson> = {}): ClientPerson {
  return {
    id,
    full_name: nombre,
    document_number: '123',
    email: null,
    phone: null,
    identification_types: { code: 'CC' },
    ...over,
  };
}

describe('groupStoreClients', () => {
  it('un pedido en línea, sin client_id, aparece con su comprador (caso Daniel Santamaría)', () => {
    const [cliente] = groupStoreClients({
      parts: [
        parte({
          status: 'at_collection',
          orders: { buyer_id: 'perfil-daniel', client_id: null, payment_status: 'approved' },
        }),
      ],
      items: [],
      clients: [],
      profiles: [persona('perfil-daniel', 'Daniel Santamaría')],
      storeNames,
    });

    expect(cliente.full_name).toBe('Daniel Santamaría');
    expect(cliente.totalOrders).toBe(1);
    expect(cliente.orders[0]).toMatchObject({
      id: 'MM-2026-000001-1',
      type: 'online',
      paymentStatus: 'Pagado',
      status: 'Confirmado',
      storeName: 'Salsamentaria, La Kelly',
    });
    expect(cliente.storeNames).toEqual(['Salsamentaria, La Kelly']);
  });

  it('un cliente de mostrador ligado a una cuenta no sale dos veces', () => {
    const clientes = groupStoreClients({
      parts: [
        parte({ order_id: 'p1', orders: { buyer_id: null, client_id: 'cliente-ana', payment_status: 'approved' } }),
        parte({ order_id: 'p2', orders: { buyer_id: 'perfil-ana', client_id: null, payment_status: 'approved' } }),
      ],
      items: [],
      clients: [persona('cliente-ana', 'Ana', { profile_id: 'perfil-ana' })],
      profiles: [persona('perfil-ana', 'Ana (cuenta)')],
      storeNames,
    });

    expect(clientes).toHaveLength(1);
    expect(clientes[0].id).toBe('cliente-ana');
    expect(clientes[0].orders.map((o) => o.type).sort()).toEqual(['local', 'online']);
  });

  it('suma lo pagado de cada parte y toma el pedido más reciente como última compra', () => {
    const pagado = { buyer_id: 'b', client_id: null, payment_status: 'approved' };
    const [cliente] = groupStoreClients({
      parts: [
        parte({ subtotal: '5000', created_at: '2026-10-01T10:00:00Z', orders: pagado }),
        parte({ subtotal: 7000, store_id: OTRA, created_at: '2026-10-05T10:00:00Z', orders: pagado }),
        // No suman: sin pagar, y pagado pero cancelado.
        parte({ subtotal: 900, created_at: '2026-09-01T10:00:00Z', orders: { ...pagado, payment_status: 'rejected' } }),
        parte({ subtotal: 800, status: 'cancelled', created_at: '2026-09-02T10:00:00Z', orders: pagado }),
      ],
      items: [],
      clients: [],
      profiles: [persona('b', 'Beto')],
      storeNames,
    });

    expect(cliente.totalSpent).toBe(12000);
    expect(cliente.lastOrderDate).toBe('2026-10-05T10:00:00Z');
    expect(cliente.storeNames).toEqual(['Otra tienda', 'Salsamentaria, La Kelly']);
  });

  it('una parte solo lleva los productos de su tienda', () => {
    const [cliente] = groupStoreClients({
      parts: [parte({ orders: { buyer_id: 'b', client_id: null, payment_status: null } })],
      items: [
        { id: 'i1', order_id: 'pedido-1', quantity: '2', unit_price: '3000', catalog_name: 'Tomate', unit_name: 'kg', store_products: { store_id: KELLY } },
        { id: 'i2', order_id: 'pedido-1', quantity: 1, unit_price: 9000, catalog_name: 'Queso', unit_name: 'und', store_products: { store_id: OTRA } },
      ],
      clients: [],
      profiles: [persona('b', 'Beto')],
      storeNames,
    });

    expect(cliente.orders[0].items).toEqual([
      { id: 'i1', name: 'Tomate', qty: 2, price: 3000, unit: 'kg', emoji: '🍅' },
    ]);
  });

  it('un cliente de mostrador sin compras sale con cero, ordenado por nombre', () => {
    const clientes = groupStoreClients({
      parts: [],
      items: [],
      clients: [persona('c2', 'Zoila'), persona('c1', 'Álvaro')],
      profiles: [],
      storeNames,
    });

    expect(clientes.map((c) => c.full_name)).toEqual(['Álvaro', 'Zoila']);
    expect(clientes[0]).toMatchObject({ totalOrders: 0, totalSpent: 0, lastOrderDate: null, storeNames: [] });
  });
});
