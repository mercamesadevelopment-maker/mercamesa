import { describe, expect, it } from 'vitest';
import { pickStore } from './store-member';
import { toStoreQueue, type StoreQueueRow } from '@/lib/orders/store-queue';
import { groupHeld, nextPayoutDate } from '@/lib/payouts/store-statement';
import { toStoreQueueView } from './views';

describe('el tendero y su tienda', () => {
  const tiendas = [
    { id: 'a', name: 'Carnes Don José' },
    { id: 'b', name: 'Quesos y Pescados' },
  ];

  it('con una sola tienda no hay que nombrarla; con varias, sí', () => {
    expect(pickStore([tiendas[0]])).toEqual({ ok: true, store: tiendas[0] });
    expect(pickStore(tiendas)).toMatchObject({ ok: false, code: 'AMBIGUO' });
    expect(pickStore(tiendas, 'quesos')).toEqual({ ok: true, store: tiendas[1] });
    expect(pickStore(tiendas, 'CARNES DON JOSE')).toEqual({ ok: true, store: tiendas[0] });
  });

  it('sin tiendas no es tendero; un nombre que no es suyo no existe', () => {
    expect(pickStore([])).toMatchObject({ ok: false, code: 'NO_PERMITIDO' });
    expect(pickStore(tiendas, 'Frutas')).toMatchObject({ ok: false, code: 'NO_EXISTE' });
  });
});

describe('pedidos_del_tendero', () => {
  const parte = (over: Partial<StoreQueueRow>): StoreQueueRow => ({
    id: 'p1',
    order_id: 'o1',
    code: 'MM-2026-000010-1',
    status: 'confirmed',
    created_at: '2026-11-18T10:00:00Z',
    subtotal: 20000,
    notes: null,
    packing_notes: null,
    has_refrigerated: false,
    orders: {
      code: 'MM-2026-000010',
      fulfillment: 'store',
      client_id: null,
      delivery_address_snapshot: { neighborhood: 'Laureles', address_line: 'Calle 1 # 2-3', phone: '3001234567' },
      profiles: { full_name: 'María Fernanda Ríos' },
    },
    ...over,
  });

  it('primero lo que hay que preparar, después lo que avanza, y lo viejo antes', () => {
    const cola = toStoreQueue(
      [
        parte({ id: 'x', code: 'X', status: 'dispatched' }),
        parte({ id: 'y', code: 'Y', status: 'packing' }),
        parte({ id: 'z', code: 'Z', status: 'confirmed', created_at: '2026-11-18T12:00:00Z' }),
        parte({ id: 'w', code: 'W', status: 'paid', created_at: '2026-11-18T08:00:00Z' }),
      ],
      [],
      []
    );
    expect(cola.map((p) => p.code)).toEqual(['W', 'Z', 'Y', 'X']);
    expect(cola[2].next).toEqual({ status: 'at_collection', label: 'Listo Recogida' });
  });

  it('del comprador solo el primer nombre y el barrio; nada de dirección, teléfono ni códigos', () => {
    const [p] = toStoreQueue(
      [parte({})],
      [{ order_id: 'o1', catalog_name: 'Chorizo', unit_name: 'lb', quantity: 2, total_price: 20000 }],
      [{ store_order_id: 'p1', status_cd: 2, driver_name: 'Juan', driver_phone: '3110000000', pickup_validation_code: '9876', validation_code: '1234' } as any]
    );
    const vista = JSON.stringify(toStoreQueueView(p));
    expect(p.buyerFirstName).toBe('María');
    expect(p.neighborhood).toBe('Laureles');
    for (const prohibido of ['Calle 1', '3001234567', '3110000000', '9876', '1234', 'Ríos']) {
      expect(vista).not.toContain(prohibido);
    }
  });

  it('marca la venta de mostrador', () => {
    const [p] = toStoreQueue([parte({ orders: { ...parte({}).orders!, client_id: 'c1' } })], [], []);
    expect(p.inStore).toBe(true);
  });
});

describe('liquidacion_del_tendero', () => {
  it('la próxima liquidación es martes o jueves, en hora de Colombia', () => {
    // Jueves 19 de noviembre de 2026, 10:00 en Colombia: es hoy. Sábado 21 → martes 24.
    expect(nextPayoutDate(new Date('2026-11-19T15:00:00Z'))).toBe('2026-11-19');
    expect(nextPayoutDate(new Date('2026-11-21T15:00:00Z'))).toBe('2026-11-24');
    // Jueves a las 23:00 en Colombia (viernes 04:00 UTC) sigue siendo jueves.
    expect(nextPayoutDate(new Date('2026-11-20T04:00:00Z'))).toBe('2026-11-19');
  });

  it('lo retenido, agrupado por razón y con su explicación', () => {
    expect(
      groupHeld([
        { reason: 'en_espera', amount: 1000 },
        { reason: 'sin_factura', amount: 500 },
        { reason: 'en_espera', amount: 2000 },
      ])
    ).toEqual([
      { reason: 'en_espera', explanation: 'Entregado hace muy poco; sigue en el periodo de espera', orders: 2, amount: 3000 },
      { reason: 'sin_factura', explanation: 'La factura electrónica todavía no se ha emitido', orders: 1, amount: 500 },
    ]);
  });
});
