import { describe, expect, it } from 'vitest';
import { DELIVERED_VISIBLE_MS, pickActiveParts, type ActiveCandidate } from './active-buyer-orders';

const ahora = new Date('2026-11-25T15:00:00Z');
const fila = (id: string, over: Partial<ActiveCandidate>): ActiveCandidate & { id: string } => ({
  id,
  status: 'confirmed',
  created_at: '2026-11-25T10:00:00Z',
  payable_until: null,
  deliveredAt: null,
  ...over,
});

describe('pickActiveParts', () => {
  it('solo lo que está en curso: ni cancelado, ni devuelto, ni vencido sin pagar', () => {
    const r = pickActiveParts(
      [
        fila('confirmado', { status: 'confirmed' }),
        fila('cancelado', { status: 'cancelled' }),
        fila('devuelto', { status: 'returned' }),
        fila('vencido', { status: 'pending', payable_until: '2026-11-25T14:00:00Z' }),
        fila('por-pagar', { status: 'pending', payable_until: '2026-11-25T16:00:00Z' }),
      ],
      ahora
    );
    expect(r.map((x) => x.id)).toEqual(['por-pagar', 'confirmado']);
  });

  it('lo entregado se ve unas horas, para que lea «fue entregado», y después sale', () => {
    const reciente = new Date(ahora.getTime() - DELIVERED_VISIBLE_MS + 60_000).toISOString();
    const viejo = new Date(ahora.getTime() - DELIVERED_VISIBLE_MS - 60_000).toISOString();
    const r = pickActiveParts(
      [fila('reciente', { status: 'delivered', deliveredAt: reciente }), fila('viejo', { status: 'delivered', deliveredAt: viejo }),
        fila('sin-fecha', { status: 'delivered', deliveredAt: null })],
      ahora
    );
    expect(r.map((x) => x.id)).toEqual(['reciente']);
  });

  it('primero lo que pide pagar, después lo más adelantado, y a igual avance lo más nuevo', () => {
    const r = pickActiveParts(
      [
        fila('empacando', { status: 'packing' }),
        fila('en-camino', { status: 'dispatched' }),
        fila('confirmado-viejo', { status: 'confirmed', created_at: '2026-11-24T10:00:00Z' }),
        fila('confirmado-nuevo', { status: 'confirmed', created_at: '2026-11-25T12:00:00Z' }),
        fila('por-pagar', { status: 'pending', payable_until: '2026-11-25T16:00:00Z' }),
      ],
      ahora
    );
    expect(r.map((x) => x.id)).toEqual(['por-pagar', 'en-camino', 'empacando', 'confirmado-nuevo', 'confirmado-viejo']);
  });
});
