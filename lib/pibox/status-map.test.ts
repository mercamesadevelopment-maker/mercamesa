import { describe, expect, it } from 'vitest';
import {
  buildBookingStatusNote,
  isForwardOrderStatus,
  piboxBookingIsClosed,
  piboxBookingStatusToOrderStatus,
  piboxPackageStatusToOrderStatus,
} from './status-map';

describe('piboxBookingStatusToOrderStatus', () => {
  it('a bordo y entregando pasan el pedido a despachado; finalizado, a entregado', () => {
    expect(piboxBookingStatusToOrderStatus(6)).toBe('dispatched');
    expect(piboxBookingStatusToOrderStatus(7)).toBe('dispatched');
    expect(piboxBookingStatusToOrderStatus(4)).toBe('delivered');
  });

  it('cancelar el mensajero NO cancela la compra', () => {
    // 102 llegó a cancelar pedidos ya pagados; 100 y 101 tampoco tocan el pedido.
    for (const s of [0, 1, 5, 100, 101, 102, 109]) {
      expect(piboxBookingStatusToOrderStatus(s)).toBeNull();
    }
  });
});

describe('piboxPackageStatusToOrderStatus', () => {
  it('mapea recogido, entregado, no recibido y devuelto', () => {
    expect(piboxPackageStatusToOrderStatus(1)).toBe('dispatched');
    expect(piboxPackageStatusToOrderStatus(2)).toBe('delivered');
    expect(piboxPackageStatusToOrderStatus(4)).toBe('returned');
    expect(piboxPackageStatusToOrderStatus(5)).toBe('returned');
    expect(piboxPackageStatusToOrderStatus(3)).toBeNull();
  });
});

describe('piboxBookingIsClosed', () => {
  it('solo sin conductor (101) y cancelada por nosotros (102)', () => {
    expect(piboxBookingIsClosed(101)).toBe(true);
    expect(piboxBookingIsClosed(102)).toBe(true);
    // 100: Pibox relanza solo.
    expect(piboxBookingIsClosed(100)).toBe(false);
    expect(piboxBookingIsClosed(null)).toBe(false);
  });
});

describe('isForwardOrderStatus', () => {
  it('solo deja avanzar', () => {
    expect(isForwardOrderStatus('at_collection', 'dispatched')).toBe(true);
    expect(isForwardOrderStatus('dispatched', 'delivered')).toBe(true);
    // Un evento atrasado no devuelve un pedido entregado.
    expect(isForwardOrderStatus('delivered', 'dispatched')).toBe(false);
    expect(isForwardOrderStatus('dispatched', 'dispatched')).toBe(false);
  });

  it('no pisa estados fuera del recorrido de Pibox', () => {
    expect(isForwardOrderStatus('cancelled' as never, 'delivered')).toBe(false);
  });
});

describe('buildBookingStatusNote', () => {
  it('incluye el conductor y la placa cuando vienen', () => {
    const nota = buildBookingStatusNote(1, { driverName: 'Ana', vehiclePlates: 'ABC12D' });
    expect(nota).toContain('Conductor: Ana (ABC12D)');
  });

  it('nombra un estado desconocido por su número', () => {
    expect(buildBookingStatusNote(999)).toBe('Pibox: estado 999');
  });
});
