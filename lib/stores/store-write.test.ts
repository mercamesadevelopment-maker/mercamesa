import { describe, expect, it } from 'vitest';
import { buildStoreInsert } from './store-create';
import { buildStoreUpdate, isStoreImagePath } from './store-update';
import { reviewSummary } from './store-listing';

const alta = { name: 'La Esquina', slug: 'la-esquina', marketplace_id: 'p' };

describe('buildStoreInsert', () => {
  it('teléfonos en E.164 y banderas: al detal por defecto, nunca verificada', () => {
    const r = buildStoreInsert({ ...alta, phone: '300 123 4567', is_active: 'true', is_wholesale: 'true' }, 's');
    expect(r).toMatchObject({
      categoryIds: null,
      insert: { id: 's', phone: '+573001234567', is_active: true, is_wholesale: true, is_retail: true, is_verified: false },
    });
  });

  it('el orden de los errores: teléfono, categorías, obligatorios', () => {
    expect(buildStoreInsert({ phone: 'abc', category_ids: 'x' }, 's')).toEqual({ error: 'El teléfono no es un número válido.' });
    expect(buildStoreInsert({ category_ids: 'x' }, 's')).toHaveProperty('error');
    expect(buildStoreInsert({ name: 'x' }, 's')).toEqual({ error: 'Missing required fields' });
  });

  it('is_retail en falso solo si se pide', () => {
    expect(buildStoreInsert({ ...alta, is_retail: 'false' }, 's')).toMatchObject({ insert: { is_retail: false } });
  });
});

describe('buildStoreUpdate', () => {
  it('vaciar un campo lo deja en null, no en "null"', () => {
    expect(buildStoreUpdate({ description: null, whatsapp: '' }, false)).toMatchObject({
      updateData: { description: null, whatsapp: null },
    });
  });

  it('el nombre no se puede vaciar', () => {
    expect(buildStoreUpdate({ name: '' }, false)).toEqual({ error: 'El nombre de la tienda es obligatorio.' });
  });

  it('el tendero no toca los campos de la plataforma; el admin sí', () => {
    const cuerpo = { slug: 'otro', is_verified: 1, is_active: false };
    expect(buildStoreUpdate(cuerpo, false)).toEqual({ updateData: {}, categoryIds: null });
    expect(buildStoreUpdate(cuerpo, true)).toMatchObject({ updateData: { slug: 'otro', is_verified: true, is_active: false } });
  });

  it('mayorista y minorista son banderas, y el horario se puede borrar', () => {
    expect(buildStoreUpdate({ is_wholesale: 0, is_retail: 'x', business_hours: null }, false)).toMatchObject({
      updateData: { is_wholesale: false, is_retail: true, business_hours: null },
    });
  });
});

describe('isStoreImagePath', () => {
  it('solo vale una imagen de la carpeta de la tienda', () => {
    expect(isStoreImagePath('imgs/s1/logo.png', 's1')).toBe(true);
    expect(isStoreImagePath('imgs/s2/logo.png', 's1')).toBe(false);
    expect(isStoreImagePath({ path: 'imgs/s1/x' }, 's1')).toBe(false);
  });
});

describe('reviewSummary', () => {
  it('sin reseñas no hay calificación, no un 5.0 de mentira', () => {
    expect(reviewSummary(null)).toEqual({ reviewCount: 0, rating: null });
    expect(reviewSummary([{ stars: 4 }, { stars: 5 }])).toEqual({ reviewCount: 2, rating: 4.5 });
  });
});
