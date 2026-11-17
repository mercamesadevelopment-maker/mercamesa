import { describe, expect, it } from 'vitest';
import { parentCategories, resolveCategory, splitCategory, subcategoriesOf } from './picker';

const cats = [
  { id: 'fv', name: 'Frutas y verduras', parent_id: null },
  { id: 'ff', name: 'Frutas frescas', parent_id: 'fv' },
  { id: 'vh', name: 'Verduras y hortalizas', parent_id: 'fv' },
  { id: 've', name: 'Velas', parent_id: null },
];

describe('picker de categorías', () => {
  it('madres y subs en orden', () => {
    expect(parentCategories(cats).map((c) => c.id)).toEqual(['fv', 've']);
    expect(subcategoriesOf(cats, 'fv').map((c) => c.id)).toEqual(['ff', 'vh']);
    expect(subcategoriesOf(cats, '')).toEqual([]);
  });

  it('separa la categoría guardada en madre y sub', () => {
    expect(splitCategory(cats, 'vh')).toEqual({ parentId: 'fv', subId: 'vh' });
    expect(splitCategory(cats, 've')).toEqual({ parentId: 've', subId: '' });
    expect(splitCategory(cats, 'vieja-borrada')).toEqual({ parentId: '', subId: '' });
  });

  it('guarda la sub; la madre sola solo si no tiene subs', () => {
    expect(resolveCategory(cats, { parentId: 'fv', subId: 'ff' })).toBe('ff');
    expect(resolveCategory(cats, { parentId: 'fv', subId: '' })).toBeNull();
    expect(resolveCategory(cats, { parentId: 'fv', subId: 'otra' })).toBeNull();
    expect(resolveCategory(cats, { parentId: 've', subId: '' })).toBe('ve');
    expect(resolveCategory(cats, { parentId: '', subId: '' })).toBeNull();
  });
});
