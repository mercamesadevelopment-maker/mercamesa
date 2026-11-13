import { describe, expect, it } from 'vitest';
import { toCategoryTree } from './category-tree';

describe('toCategoryTree', () => {
  it('agrupa las subcategorías bajo su categoría y suma los productos', () => {
    expect(
      toCategoryTree([
        { categoria: 'Bebidas', subcategoria: 'Café, chocolate y malteadas', total: '83' },
        { categoria: 'Bebidas', subcategoria: 'Bebidas alcohólicas', total: 23 },
        { categoria: 'Frutas y verduras', subcategoria: 'Frutas frescas', total: 125 },
      ])
    ).toEqual([
      {
        name: 'Bebidas',
        total: 106,
        subcategories: [
          { name: 'Café, chocolate y malteadas', total: 83 },
          { name: 'Bebidas alcohólicas', total: 23 },
        ],
      },
      { name: 'Frutas y verduras', total: 125, subcategories: [{ name: 'Frutas frescas', total: 125 }] },
    ]);
  });

  it('un producto que cuelga directo de la categoría suma a ella sin crear subcategoría', () => {
    expect(
      toCategoryTree([
        { categoria: 'Velas', subcategoria: null, total: 2 },
        { categoria: 'Velas', subcategoria: 'Velas y artículos religiosos', total: 11 },
      ])
    ).toEqual([{ name: 'Velas', total: 13, subcategories: [{ name: 'Velas y artículos religiosos', total: 11 }] }]);
  });

  it('ignora filas sin categoría', () => {
    expect(toCategoryTree([{ categoria: null, subcategoria: 'X', total: 1 }])).toEqual([]);
  });
});
