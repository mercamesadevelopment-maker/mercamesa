import { describe, expect, it } from 'vitest';
import { toDeliveryTimeline, toDeliveryView, type DeliveryEventRow } from './delivery-view';
import type { PiboxBookingRow } from './types';

const SO = 'so-1';
const ev = (min: number, over: Partial<DeliveryEventRow>): DeliveryEventRow => ({
  received_at: `2026-10-14T15:${String(min).padStart(2, '0')}:30Z`,
  event_created_at: `2026-10-14T15:${String(min).padStart(2, '0')}:00Z`,
  event_cd: 0,
  status_cd: 0,
  driver_name: null,
  store_order_id: SO,
  ...over,
});

// Lo que pasó en la prueba real del 14 de octubre (MM-2026-001091-1).
const prueba: DeliveryEventRow[] = [
  ev(13, { status_cd: 0 }),
  ev(18, { status_cd: 1, driver_name: 'Álvaro Ruiz' }),
  ev(19, { status_cd: 100, driver_name: 'Álvaro Ruiz' }),
  ev(19, { status_cd: 0 }),
  ev(23, { status_cd: 1, driver_name: 'Mateo Atehortúa' }),
];

describe('toDeliveryTimeline', () => {
  it('cuenta la historia del domicilio en orden', () => {
    expect(toDeliveryTimeline(prueba, 'store').map((e) => e.text)).toEqual([
      'Buscando conductor',
      'Álvaro Ruiz aceptó y va hacia la tienda',
      'Álvaro Ruiz canceló; Picap busca otro conductor',
      'Buscando conductor',
      'Mateo Atehortúa aceptó y va hacia la tienda',
    ]);
  });

  it('ordena por la fecha del evento, no por la de llegada', () => {
    const desordenado = [prueba[2], prueba[0], prueba[1]];
    expect(toDeliveryTimeline(desordenado, 'admin')[0].text).toBe('Buscando conductor');
  });

  it('no repite la misma frase seguida (Picap manda varios avisos por un cambio)', () => {
    const repetidos = [ev(18, { status_cd: 1, driver_name: 'Ana' }), ev(18, { status_cd: 1, driver_name: 'Ana' })];
    expect(toDeliveryTimeline(repetidos, 'store')).toHaveLength(1);
  });

  it('omite los avisos que no se asociaron a un pedido', () => {
    expect(toDeliveryTimeline([ev(10, { store_order_id: null })], 'admin')).toEqual([]);
  });

  it('el comprador no recibe la línea de tiempo', () => {
    expect(toDeliveryTimeline(prueba, 'buyer')).toEqual([]);
  });

  it('marca las cancelaciones para llamar la atención', () => {
    const t = toDeliveryTimeline(prueba, 'store');
    expect(t[2].tone).toBe('warn');
    expect(t[1].tone).toBe('ok');
  });

  it('nombra los avisos del paquete', () => {
    expect(toDeliveryTimeline([ev(30, { event_cd: 1, status_cd: 2 })], 'store')[0].text).toBe('Paquete entregado');
  });
});

describe('toDeliveryView tras un relanzamiento', () => {
  it('«canceló el conductor» se muestra como búsqueda de otro, no como cerrado', () => {
    const v = toDeliveryView({ booking_id: 'b', status_cd: 100, package_status_cd: 0, is_active: true } as PiboxBookingRow, 'store');
    expect(v.stage).toBe('searching');
    expect(v.statusLabel).toBe('Buscando otro conductor');
  });
});
