import { describe, expect, it } from 'vitest';
import { matchItems, pickPart, reasonsCatalog, whoHandles } from './cases';
import { isAllowedMediaUrl, photoTypeOf } from './media';
import { getPqrsReason } from '@/lib/pqrs/reasons';

describe('registrar_caso: la parte del pedido', () => {
  const partes = [
    { id: 'a', code: 'MM-2026-000010-1', storeName: 'Carnes' },
    { id: 'b', code: 'MM-2026-000010-2', storeName: 'Quesos' },
  ];

  it('con el código de la parte, esa; con el del pedido de una sola tienda, la única', () => {
    expect(pickPart('mm-2026-000010-2', partes)).toEqual({ ok: true, part: partes[1] });
    expect(pickPart('MM-2026-000011', [partes[0]])).toEqual({ ok: true, part: partes[0] });
  });

  it('con el del pedido de varias tiendas, pide cuál; sin partes, no existe', () => {
    const r = pickPart('MM-2026-000010', partes);
    expect(r.ok).toBe(false);
    expect('message' in r && r.message).toMatch(/MM-2026-000010-1 \(Carnes\), MM-2026-000010-2 \(Quesos\)/);
    expect(pickPart('MM-2026-000099', [])).toEqual({ ok: false, message: 'No encontramos ese pedido.' });
  });
});

describe('registrar_caso: los productos por su nombre', () => {
  const lineas = [
    { id: 'l1', name: 'Pechuga de pollo', quantity: 2 },
    { id: 'l2', name: 'Pollo entero', quantity: 1 },
    { id: 'l3', name: 'Aguacate Hass', quantity: 3 },
  ];

  it('exacto sin tildes, o el único que lo contiene; sin cantidad, la de la línea', () => {
    expect(matchItems(lineas, [{ producto: 'aguacate' }, { producto: 'POLLO ENTERO', cantidad: 1 }])).toEqual({
      ok: true,
      items: [
        { orderItemId: 'l3', quantity: 3 },
        { orderItemId: 'l2', quantity: 1 },
      ],
    });
  });

  it('si coincide con varios pide cuál, y si no está dice qué hay', () => {
    expect(matchItems(lineas, [{ producto: 'pollo' }])).toMatchObject({ ok: false, message: expect.stringMatching(/varios/) });
    expect(matchItems(lineas, [{ producto: 'arroz' }])).toMatchObject({
      ok: false,
      message: expect.stringMatching(/Pechuga de pollo, Pollo entero, Aguacate Hass/),
    });
  });
});

describe('registrar_caso: quién atiende', () => {
  it('la tienda primero en un reclamo con pedido; si no, MercaMesa', () => {
    expect(whoHandles(getPqrsReason('producto_faltante')!, true, 24)).toMatch(/tienda, que tiene 24 horas/);
    expect(whoHandles(getPqrsReason('sugerencia')!, false, 24)).toBe('Lo atiende el equipo de MercaMesa.');
  });

  it('la lista de motivos dice para quién es cada uno y qué pide', () => {
    expect(reasonsCatalog()).toMatch(/producto_mal_estado \(comprador; pide pedido, productos, foto\)/);
    expect(reasonsCatalog()).toMatch(/bloquear_comprador \(tendero/);
  });
});

describe('fotos del chat', () => {
  const hosts = ['media.meteor.example'];

  it('solo https, del dominio permitido o un subdominio, sin usuario ni puerto', () => {
    expect(isAllowedMediaUrl('https://media.meteor.example/f/1.jpg', hosts)).toBe(true);
    expect(isAllowedMediaUrl('https://cdn.media.meteor.example/f/1.jpg', hosts)).toBe(true);
    expect(isAllowedMediaUrl('http://media.meteor.example/f/1.jpg', hosts)).toBe(false);
    expect(isAllowedMediaUrl('https://media.meteor.example.evil.com/1.jpg', hosts)).toBe(false);
    expect(isAllowedMediaUrl('https://evilmedia.meteor.example.com/1.jpg', hosts)).toBe(false);
    expect(isAllowedMediaUrl('https://u:p@media.meteor.example/1.jpg', hosts)).toBe(false);
    expect(isAllowedMediaUrl('https://media.meteor.example:8443/1.jpg', hosts)).toBe(false);
    expect(isAllowedMediaUrl('https://169.254.169.254/latest', hosts)).toBe(false);
    expect(isAllowedMediaUrl('no es url', hosts)).toBe(false);
    expect(isAllowedMediaUrl('https://media.meteor.example/1.jpg', [])).toBe(false);
  });

  it('el tipo de la respuesta: solo JPG, PNG o WebP', () => {
    expect(photoTypeOf('image/jpeg; charset=binary')).toBe('image/jpeg');
    expect(photoTypeOf('IMAGE/PNG')).toBe('image/png');
    expect(photoTypeOf('image/svg+xml')).toBeNull();
    expect(photoTypeOf(null)).toBeNull();
  });
});
