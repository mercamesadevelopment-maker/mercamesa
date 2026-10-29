import { describe, expect, it } from 'vitest';
import { offerDisplayStatus } from './offer-display-status';

const now = new Date('2026-10-13T12:00:00Z');

describe('offerDisplayStatus', () => {
  it('una oferta activa cuya fecha de fin pasó se muestra vencida', () => {
    expect(
      offerDisplayStatus({ status: 'active', starts_at: '2026-10-01T00:00:00Z', ends_at: '2026-10-12T00:00:00Z' }, now)
    ).toBe('expired');
  });

  it('una oferta activa que aún no empieza se muestra programada', () => {
    expect(
      offerDisplayStatus({ status: 'active', starts_at: '2026-10-20T00:00:00Z', ends_at: null }, now)
    ).toBe('scheduled');
  });

  it('una oferta activa dentro de sus fechas sigue activa', () => {
    expect(
      offerDisplayStatus({ status: 'active', starts_at: '2026-10-01T00:00:00Z', ends_at: '2026-10-31T00:00:00Z' }, now)
    ).toBe('active');
  });

  it('el último instante de la vigencia todavía cuenta', () => {
    expect(offerDisplayStatus({ status: 'active', starts_at: null, ends_at: now.toISOString() }, now)).toBe('active');
  });

  it('un estado que no es activo se respeta tal cual', () => {
    expect(
      offerDisplayStatus({ status: 'pending' as never, starts_at: null, ends_at: '2020-01-01T00:00:00Z' }, now)
    ).toBe('pending');
  });
});
