import { describe, expect, it } from 'vitest';
import { deliveryStage, toDeliveryView } from './delivery-view';
import type { PiboxBookingRow } from './types';

const fila = (over: Partial<PiboxBookingRow> = {}): PiboxBookingRow =>
  ({
    booking_id: 'b-1',
    status_cd: 1,
    package_status_cd: 0,
    driver_name: 'Ana',
    driver_phone: '+573001234567',
    vehicle_plates: 'ABC12D',
    tracking_link: 'https://pibox.app/tracking/x',
    updated_at: '2026-10-13T12:00:00Z',
    is_active: true,
    final_cost: null,
    estimated_cost: 9000,
    pickup_validation_code: 'RECOGE',
    validation_code: 'ENTREGA',
    relaunched_to_booking_id: 'b-2',
    raw: { secreto: true },
    ...over,
  }) as PiboxBookingRow;

describe('deliveryStage', () => {
  it.each([
    [0, 'searching'],
    [1, 'assigned'],
    [5, 'picking_up'],
    [6, 'on_the_way'],
    [7, 'on_the_way'],
    [4, 'delivered'],
    [109, 'scheduled'],
    [100, 'closed'],
    [101, 'closed'],
    [102, 'closed'],
  ])('estado %i → %s', (status_cd, etapa) => {
    expect(deliveryStage({ status_cd, package_status_cd: 0 })).toBe(etapa);
  });

  it('el paquete entregado cuenta como entregado aunque la reserva no haya cerrado', () => {
    expect(deliveryStage({ status_cd: 7, package_status_cd: 2 })).toBe('delivered');
  });
});

describe('toDeliveryView: lo que ve cada rol', () => {
  it('el comprador no ve costo ni código de recogida', () => {
    const v = toDeliveryView(fila(), 'buyer');
    expect(v.cost).toBeUndefined();
    expect(v.pickupValidationCode).toBeUndefined();
    expect(v.deliveryValidationCode).toBe('ENTREGA');
    expect(v.relaunchedTo).toBeUndefined();
  });

  it('la tienda no ve el código de entrega', () => {
    const v = toDeliveryView(fila(), 'store');
    expect(v.cost).toBe(9000);
    expect(v.pickupValidationCode).toBe('RECOGE');
    expect(v.deliveryValidationCode).toBeUndefined();
  });

  it('el admin ve todo, menos el raw', () => {
    const v = toDeliveryView(fila({ final_cost: 8500 }), 'admin');
    expect(v.cost).toBe(8500);
    expect(v.relaunchedTo).toBe('b-2');
    expect(JSON.stringify(v)).not.toContain('secreto');
  });

  it('sin datos del conductor, driver es null', () => {
    const v = toDeliveryView(fila({ driver_name: null, driver_phone: null, vehicle_plates: null }), 'buyer');
    expect(v.driver).toBeNull();
  });
});
