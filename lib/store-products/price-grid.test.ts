import { describe, expect, it } from 'vitest';
import {
  buildPriceBatch,
  changedFields,
  countPriceErrors,
  draftFromValues,
  parsePriceBatchBody,
  priceValueFromPaste,
  rowFromDraft,
  validateRow,
  type PriceValues,
} from './price-grid';

const actual: PriceValues = { price: 5000, wsPrice: 4000, wsMin: 10, stock: 12, isActive: true };
const original = draftFromValues('p1', actual);

describe('draftFromValues y changedFields', () => {
  it('lo guardado no cuenta como cambio', () => {
    expect(changedFields(original, { ...original })).toEqual([]);
  });

  it('marca solo lo que se tocó', () => {
    expect(changedFields(original, { ...original, price: '5500', isActive: false })).toEqual(['price', 'isActive']);
  });

  it('vacío para lo que no tiene valor', () => {
    expect(draftFromValues('p2', { ...actual, wsPrice: null, wsMin: null })).toMatchObject({ wsPrice: '', wsMin: '' });
  });
});

describe('rowFromDraft', () => {
  it('manda solo los campos cambiados, ya en números', () => {
    const r = rowFromDraft(original, { ...original, price: '$ 5.500', stock: '20' }, actual);
    expect(r.errors).toEqual({});
    expect(r.row).toEqual({ id: 'p1', price_per_unit: 5500, stock: 20 });
  });

  it('una fila sin cambios no se manda ni se valida', () => {
    // Un mayorista viejo mayor que el precio no bloquea si nadie lo toca.
    const raro = draftFromValues('p3', { ...actual, wsPrice: 9000 });
    expect(rowFromDraft(raro, { ...raro }, { ...actual, wsPrice: 9000 })).toEqual({ row: null, errors: {} });
  });

  it('lo que no es número queda como error de la celda', () => {
    const r = rowFromDraft(original, { ...original, price: 'abc' }, actual);
    expect(r.errors.price).toMatch(/no es un número/);
  });

  it('el precio y el stock no pueden quedar vacíos; el mayorista sí', () => {
    const r = rowFromDraft(original, { ...original, price: '', stock: '', wsPrice: '' }, actual);
    expect(r.errors.price).toBeDefined();
    expect(r.errors.stock).toBeDefined();
    expect(r.errors.wsPrice).toBeUndefined();
    expect(r.row?.wholesale_price).toBeNull();
  });

  it('bajar el precio por debajo del mayorista que ya tenía es un error', () => {
    const r = rowFromDraft(original, { ...original, price: '3000' }, actual);
    expect(r.errors.wsPrice).toMatch(/mayor que el precio/);
  });
});

describe('validateRow', () => {
  it('reglas de cada campo', () => {
    expect(validateRow({ id: 'x', price_per_unit: 0 }, actual).price).toBeDefined();
    expect(validateRow({ id: 'x', wholesale_price: 6000 }, actual).wsPrice).toBeDefined();
    expect(validateRow({ id: 'x', wholesale_min_qty: 1.5 }, actual).wsMin).toBeDefined();
    expect(validateRow({ id: 'x', stock: -1 }, actual).stock).toBeDefined();
    expect(validateRow({ id: 'x', price_per_unit: 6000, wholesale_price: 6000, stock: 0, wholesale_min_qty: null }, actual)).toEqual({});
  });
});

describe('buildPriceBatch', () => {
  it('junta las filas cambiadas y sus errores', () => {
    const o2 = draftFromValues('p2', actual);
    const { rows, errors } = buildPriceBatch(
      new Map([['p1', original], ['p2', o2]]),
      [{ ...original, stock: '30' }, { ...o2, price: '-5' }],
      new Map([['p1', actual], ['p2', actual]])
    );
    expect(rows.map((r) => r.id)).toEqual(['p1', 'p2']);
    expect(countPriceErrors(errors)).toBe(1);
    expect(errors.p2.price).toBeDefined();
  });
});

describe('priceValueFromPaste', () => {
  it('normaliza los números de Excel', () => {
    expect(priceValueFromPaste('price', '$ 1.200')).toEqual({ ok: true, value: '1200' });
    expect(priceValueFromPaste('stock', '2,5')).toEqual({ ok: true, value: '2.5' });
    expect(priceValueFromPaste('wsPrice', '')).toEqual({ ok: true, value: '' });
  });

  it('lo que no se entiende vuelve como error', () => {
    expect(priceValueFromPaste('price', 'abc').ok).toBe(false);
    expect(priceValueFromPaste('isActive', 'quizás').ok).toBe(false);
  });

  it('sí y no en la casilla', () => {
    expect(priceValueFromPaste('isActive', 'Sí')).toEqual({ ok: true, value: true });
    expect(priceValueFromPaste('isActive', 'no')).toEqual({ ok: true, value: false });
  });
});

describe('parsePriceBatchBody', () => {
  it('acepta lo bien formado', () => {
    expect(parsePriceBatchBody({ rows: [{ id: 'a', price_per_unit: 10, wholesale_price: null, is_active: false }] })).toEqual({
      rows: [{ id: 'a', price_per_unit: 10, wholesale_price: null, is_active: false }],
    });
  });

  it('rechaza tipos raros, ids repetidos y lotes vacíos', () => {
    expect('error' in parsePriceBatchBody({ rows: [] })).toBe(true);
    expect('error' in parsePriceBatchBody({ rows: [{ id: 'a', price_per_unit: '10' }] })).toBe(true);
    expect('error' in parsePriceBatchBody({ rows: [{ id: 'a' }, { id: 'a' }] })).toBe(true);
  });
});
