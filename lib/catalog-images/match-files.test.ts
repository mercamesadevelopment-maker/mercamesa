import { describe, expect, it } from 'vitest';
import { imageKey, matchImageFiles, type ImageTarget } from './match-files';

const p = (id: string, slug: string, name: string, hasImage = false): ImageTarget => ({ id, slug, name, hasImage });
const f = (name: string, size = 1000) => ({ name, size });

const catalogo = [
  p('1', 'tomate-chonto', 'Tomate chonto'),
  p('2', 'papa-criolla', 'Papa criolla', true),
  p('3', 'limon-tahiti', 'Limón tahití'),
  p('4', 'cebolla-larga', 'Cebolla'),
  p('5', 'cebolla-cabezona', 'Cebolla'),
];

describe('imageKey', () => {
  it('iguala slug, nombre y archivo', () => {
    expect(imageKey('tomate-chonto')).toBe('tomate chonto');
    expect(imageKey('Tomate Chonto')).toBe('tomate chonto');
    expect(imageKey('tomate_chonto')).toBe('tomate chonto');
    expect(imageKey('Limón  Tahití')).toBe('limon tahiti');
  });
});

describe('matchImageFiles', () => {
  it('por slug', () => {
    const [m] = matchImageFiles([f('tomate-chonto.jpg')], catalogo);
    expect(m.status).toBe('ok');
    expect(m.product?.id).toBe('1');
  });

  it('por nombre, sin importar tildes ni mayúsculas', () => {
    const [m] = matchImageFiles([f('LIMON TAHITI.PNG')], catalogo);
    expect(m.status).toBe('ok');
    expect(m.product?.id).toBe('3');
  });

  it('un nombre repetido es ambiguo, pero su slug no', () => {
    const [a, b] = matchImageFiles([f('Cebolla.jpg'), f('cebolla-larga.jpg')], catalogo);
    expect(a.status).toBe('ambiguous');
    expect(b.status).toBe('ok');
    expect(b.product?.id).toBe('4');
  });

  it('avisa si el producto ya tiene foto', () => {
    expect(matchImageFiles([f('papa-criolla.webp')], catalogo)[0].status).toBe('replaces');
  });

  it('dos fotos para el mismo producto: las dos quedan marcadas', () => {
    const r = matchImageFiles([f('tomate-chonto.jpg'), f('Tomate chonto.png')], catalogo);
    expect(r.map((m) => m.status)).toEqual(['duplicate', 'duplicate']);
  });

  it('sin producto, extensión no aceptada o muy pesada', () => {
    const r = matchImageFiles(
      [f('mango.jpg'), f('tomate-chonto.heic'), f('limon-tahiti.jpg', 9 * 1024 * 1024)],
      catalogo
    );
    expect(r.map((m) => m.status)).toEqual(['no_match', 'invalid', 'invalid']);
  });

  it('conserva la posición de cada archivo', () => {
    const r = matchImageFiles([f('mango.jpg'), f('tomate-chonto.jpg')], catalogo);
    expect(r.map((m) => m.index)).toEqual([0, 1]);
  });
});
