import { describe, expect, it } from 'vitest';
import { parseStoreEvidenceInput, storeMustPhotograph, type StoreEvidenceContext } from './store-evidence-rules';

const base: StoreEvidenceContext = {
  consolidated: false,
  config: { runnerRequired: false, logisticsRequired: false },
  marketplaceHasLogistics: false,
  ownPickup: false,
};

describe('storeMustPhotograph', () => {
  it('una tienda en una plaza sin logística: la foto la toma el tendero', () => {
    expect(storeMustPhotograph(base)).toBe(true);
  });

  it('una tienda en una plaza con logística: la recibe logística', () => {
    expect(storeMustPhotograph({ ...base, marketplaceHasLogistics: true })).toBe(false);
  });

  it('una tienda que despacha desde su dirección: el tendero, aunque la plaza tenga logística', () => {
    expect(storeMustPhotograph({ ...base, marketplaceHasLogistics: true, ownPickup: true })).toBe(true);
  });

  it('varias tiendas con logística: la recibe logística en la bahía', () => {
    expect(
      storeMustPhotograph({ ...base, consolidated: true, config: { runnerRequired: true, logisticsRequired: true } })
    ).toBe(false);
  });

  it('varias tiendas sin logística (solo patinador o ninguno): el tendero', () => {
    expect(storeMustPhotograph({ ...base, consolidated: true, config: { runnerRequired: true, logisticsRequired: false } })).toBe(true);
    expect(storeMustPhotograph({ ...base, consolidated: true, marketplaceHasLogistics: true })).toBe(true);
  });
});

describe('parseStoreEvidenceInput', () => {
  it('fotos y observación', () => {
    expect(parseStoreEvidenceInput({ photos: ['tmp/u/a.jpg'], observation: '  2 bolsas  ' })).toEqual({
      input: { photos: ['tmp/u/a.jpg'], observation: '2 bolsas' },
    });
  });

  it('sin nada: sin fotos y sin observación (quien llama decide si hacen falta)', () => {
    expect(parseStoreEvidenceInput({})).toEqual({ input: { photos: [], observation: null } });
  });

  it('rechaza fotos que no son rutas, más de 6 y una observación larga', () => {
    expect(parseStoreEvidenceInput({ photos: [1] })).toHaveProperty('error');
    expect(parseStoreEvidenceInput({ photos: Array(7).fill('x') })).toHaveProperty('error');
    expect(parseStoreEvidenceInput({ observation: 'x'.repeat(501) })).toHaveProperty('error');
  });
});
