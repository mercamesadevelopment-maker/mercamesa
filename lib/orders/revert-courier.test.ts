import { describe, expect, it } from 'vitest';
import { COURIER_HAS_PACKAGE_MESSAGE, decideCourierOnRevert, type RevertBooking } from './revert-courier';

const reserva = (status_cd: number | null, relaunched_to_booking_id: string | null = null): RevertBooking => ({
  booking_id: 'original',
  relaunched_to_booking_id,
  status_cd,
});

describe('decideCourierOnRevert', () => {
  it('MM-2026-001100: regresar a «Empacando» con la búsqueda relanzada cancela el último id', () => {
    // Pibox la relanzó cinco veces; el id original ya no busca a nadie.
    expect(decideCourierOnRevert({ target: 'packing', booking: reserva(0, 'relanzada-5') })).toEqual({
      action: 'cancel',
      bookingId: 'relanzada-5',
    });
  });

  it('un conductor canceló y Pibox relanzó: la búsqueda sigue y se cancela la relanzada', () => {
    expect(decideCourierOnRevert({ target: 'packing', booking: reserva(100, 'relanzada-1') })).toEqual({
      action: 'cancel',
      bookingId: 'relanzada-1',
    });
  });

  it('antes de «Listo Recogida», un mensajero que aún no tiene el paquete se cancela', () => {
    for (const status of [0, 1, 5, 109, null]) {
      for (const target of ['pending', 'paid', 'confirmed', 'packing'] as const) {
        expect(decideCourierOnRevert({ target, booking: reserva(status) })).toEqual({ action: 'cancel', bookingId: 'original' });
      }
    }
  });

  it('si el conductor ya tiene el paquete, no se deja regresar', () => {
    for (const status of [6, 7]) {
      expect(decideCourierOnRevert({ target: 'packing', booking: reserva(status) })).toEqual({
        action: 'block',
        message: COURIER_HAS_PACKAGE_MESSAGE,
      });
    }
  });

  it('a «Listo Recogida» o después, el mensajero sigue sirviendo', () => {
    for (const target of ['at_collection', 'dispatched', 'delivered'] as const) {
      expect(decideCourierOnRevert({ target, booking: reserva(0) })).toEqual({ action: 'keep' });
      expect(decideCourierOnRevert({ target, booking: reserva(6) })).toEqual({ action: 'keep' });
    }
  });

  it('sin reserva, o con una terminada o cerrada, no hay nada que cancelar', () => {
    expect(decideCourierOnRevert({ target: 'packing', booking: null })).toEqual({ action: 'keep' });
    for (const status of [4, 100, 101, 102]) {
      expect(decideCourierOnRevert({ target: 'packing', booking: reserva(status) })).toEqual({ action: 'keep' });
    }
  });
});
