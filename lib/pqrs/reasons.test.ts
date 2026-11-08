import { describe, expect, it } from 'vitest';
import { getPqrsReason, kindsFor, kindsOf, PQRS_KIND_HELP, PQRS_KIND_LABELS, PQRS_KINDS, reasonsFor } from './reasons';
import { validateNewPqrs } from './rules';
import type { PqrsOrderContext } from './types';

describe('PQRSF: los tipos', () => {
  it('el comprador ve los cinco, en el orden de la sigla', () => {
    expect(kindsFor('buyer')).toEqual(['peticion', 'queja', 'reclamo', 'sugerencia', 'felicitacion']);
  });

  it('cada tipo del comprador tiene al menos un motivo', () => {
    for (const k of PQRS_KINDS) expect(reasonsFor('buyer').some((r) => r.kind === k)).toBe(true);
  });

  it('el tendero solo ve los tipos que tienen motivos suyos', () => {
    const delTendero = kindsFor('seller');
    expect(delTendero.length).toBeGreaterThan(0);
    expect(delTendero).not.toContain('felicitacion');
    for (const k of delTendero) expect(reasonsFor('seller').some((r) => r.kind === k)).toBe(true);
  });

  it('cada tipo tiene nombre y ayuda', () => {
    for (const k of PQRS_KINDS) {
      expect(PQRS_KIND_LABELS[k]).toBeTruthy();
      expect(PQRS_KIND_HELP[k]).toBeTruthy();
    }
    expect(PQRS_KIND_LABELS.felicitacion).toBe('Felicitación');
  });

  it('kindsOf respeta el orden aunque la lista venga desordenada', () => {
    expect(kindsOf([{ kind: 'felicitacion' }, { kind: 'queja' }, { kind: 'queja' }])).toEqual(['queja', 'felicitacion']);
  });
});

describe('PQRSF: la felicitación', () => {
  const felicitacion = getPqrsReason('felicitacion')!;

  it('la ve la tienda, no pide respuesta de ella ni devuelve nada', () => {
    expect(felicitacion).toMatchObject({
      kind: 'felicitacion',
      openedBy: 'buyer',
      order: 'optional',
      items: 'none',
      photo: false,
      storeSees: true,
      routesToStore: false,
      refund: 'none',
      defaultLiable: null,
    });
  });

  const pedido: PqrsOrderContext = {
    storeOrderId: 'so1',
    code: 'MM-2026-000001-1',
    storeId: 's1',
    storeName: 'Tienda',
    status: 'delivered',
    createdAt: '2026-11-01T00:00:00Z',
    buyerName: null,
    paid: true,
    deliveredAt: '2026-11-01T00:00:00Z',
    items: [],
  };
  const base = { reason: felicitacion, items: [], photos: 0, claimWindowHours: 48, description: 'Todo llegó fresco y a tiempo, gracias.' };

  it('se radica sin pedido', () => {
    expect(validateNewPqrs({ ...base, order: null })).toBeNull();
  });

  it('y con pedido, aunque haya pasado el plazo de reclamo', () => {
    expect(validateNewPqrs({ ...base, order: { ...pedido, deliveredAt: '2020-01-01T00:00:00Z' } })).toBeNull();
  });

  it('sin productos marcados', () => {
    expect(validateNewPqrs({ ...base, order: pedido, items: [{ orderItemId: 'x', quantity: 1 }] })).toMatch(/no lleva productos/);
  });
});
