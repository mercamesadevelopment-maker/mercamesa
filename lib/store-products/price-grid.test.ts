import { describe, expect, it } from 'vitest';
import {
  buildPriceBatch,
  changedFields,
  countPriceErrors,
  draftFromValues,
  parsePriceBatchBody,
  priceValueFromPaste,
  rowFromDraft,
  splitCategoryChanges,
  validateRow,
  UNPRICED_PUBLISH_MESSAGE,
  type PriceValues,
} from './price-grid';

const actual: PriceValues = { unitId: 'u-kg', price: 5000, wsPrice: 4000, wsMin: 10, stock: 12, isActive: true };
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

  it('un decimal de tres cifras ya normalizado no se lee como miles (2,125 kg no son 2125)', () => {
    // Regresión: el borrador guarda «2.125» (lo deja así `priceValueFromPaste` o
    // el Excel importado) y al guardar se volvía a leer en formato colombiano.
    const r = rowFromDraft(original, { ...original, stock: '2.125' }, actual);
    expect(r.row).toEqual({ id: 'p1', stock: 2.125 });
    const escrito = priceValueFromPaste('stock', '2.1250');
    expect(escrito).toEqual({ ok: true, value: '2.125' });
    expect(rowFromDraft(original, { ...original, stock: String((escrito as { value: string }).value) }, actual).row).toEqual({ id: 'p1', stock: 2.125 });
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

  it('no deja publicar sin precio (los productos que llegan solos por el grupo)', () => {
    const sinPrecio = { ...actual, price: 0, isActive: false };
    expect(validateRow({ id: 'x', is_active: true }, sinPrecio).isActive).toBe(UNPRICED_PUBLISH_MESSAGE);
    expect(validateRow({ id: 'x', is_active: true, price_per_unit: 4500 }, sinPrecio)).toEqual({});
    expect(validateRow({ id: 'x', stock: 10 }, sinPrecio)).toEqual({});
    // Un precio nuevo inválido ya tiene su error: no se repite en Publicado.
    expect(validateRow({ id: 'x', is_active: true, price_per_unit: 0 }, sinPrecio).isActive).toBeUndefined();
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

describe('unidad de medida', () => {
  const units = [
    { id: 'u-kg', name: 'Kilogramo', abbreviation: 'kg' },
    { id: 'u-lb', name: 'Libra', abbreviation: 'lb' },
  ];

  it('se pega por abreviatura o por nombre, sin tildes', () => {
    expect(priceValueFromPaste('unit', 'LB', units)).toEqual({ ok: true, value: 'u-lb' });
    expect(priceValueFromPaste('unit', 'kilogramo', units)).toEqual({ ok: true, value: 'u-kg' });
    expect(priceValueFromPaste('unit', 'arroba', units).ok).toBe(false);
  });

  it('cambiarla manda unit_id; vaciarla es un error', () => {
    expect(rowFromDraft(original, { ...original, unit: 'u-lb' }, actual).row).toEqual({ id: 'p1', unit_id: 'u-lb' });
    expect(rowFromDraft(original, { ...original, unit: '' }, actual).errors.unit).toBeDefined();
  });
});

describe('parsePriceBatchBody', () => {
  it('acepta lo bien formado', () => {
    expect(parsePriceBatchBody({ rows: [{ id: 'a', price_per_unit: 10, wholesale_price: null, is_active: false }] })).toEqual({
      rows: [{ id: 'a', price_per_unit: 10, wholesale_price: null, is_active: false }],
    });
  });

  it('rechaza tipos raros, ids repetidos y lotes vacíos', () => {
    expect('error' in parsePriceBatchBody({ rows: [{ id: 'a', unit_id: 3 }] })).toBe(true);
    expect('error' in parsePriceBatchBody({ rows: [] })).toBe(true);
    expect('error' in parsePriceBatchBody({ rows: [{ id: 'a', price_per_unit: '10' }] })).toBe(true);
    expect('error' in parsePriceBatchBody({ rows: [{ id: 'a' }, { id: 'a' }] })).toBe(true);
  });
});

describe('categoría (solo admin)', () => {
  const cats = [
    { id: 'c-ff', name: 'Frutas frescas', label: 'Frutas y verduras › Frutas frescas' },
    { id: 'c-vh', name: 'Verduras y hortalizas', label: 'Frutas y verduras › Verduras y hortalizas' },
  ];
  const o = draftFromValues('s1', { ...actual, categoryId: 'c-ff' });

  it('se pega por «Madre › Sub» o por la sub', () => {
    expect(priceValueFromPaste('category', 'Frutas y verduras > Verduras y hortalizas', [], cats)).toEqual({ ok: true, value: 'c-vh' });
    expect(priceValueFromPaste('category', 'frutas frescas', [], cats)).toEqual({ ok: true, value: 'c-ff' });
    expect(priceValueFromPaste('category', 'Juguetes', [], cats).ok).toBe(false);
  });

  it('cambiarla manda category_id; vaciarla es error', () => {
    expect(rowFromDraft(o, { ...o, category: 'c-vh' }, actual).row).toEqual({ id: 's1', category_id: 'c-vh' });
    expect(rowFromDraft(o, { ...o, category: '' }, actual).errors.category).toBeDefined();
  });

  it('separa la categoría (al catálogo) del resto (a la tienda)', () => {
    const catalogo: Record<string, string> = { s1: 'p1', s2: 'p1', s3: 'p2' };
    const r = splitCategoryChanges(
      [
        { id: 's1', category_id: 'c-vh', stock: 5 },
        { id: 's2', category_id: 'c-vh' },
        { id: 's3', price_per_unit: 100 },
      ],
      (id) => catalogo[id]
    );
    expect(r.catalogRows).toEqual([{ id: 'p1', category_id: 'c-vh' }]);
    expect(r.storeRows).toEqual([{ id: 's1', stock: 5 }, { id: 's3', price_per_unit: 100 }]);
    expect(r.rowsByCatalog.get('p1')).toEqual(['s1', 's2']);
    expect(r.errors).toEqual({});
  });

  it('el mismo producto en dos filas con categorías distintas es error', () => {
    const r = splitCategoryChanges(
      [
        { id: 's1', category_id: 'c-vh' },
        { id: 's2', category_id: 'c-ff' },
      ],
      () => 'p1'
    );
    expect(r.catalogRows).toEqual([]);
    expect(Object.keys(r.errors)).toEqual(['s1', 's2']);
  });
});
