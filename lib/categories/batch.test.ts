import { describe, expect, it } from 'vitest';
import {
  buildCategoryBatch,
  changedFields,
  countErrors,
  emptyDraft,
  newCategoryKey,
  parsePastedCells,
  validateCategories,
  valueFromPaste,
  type CategoryDraft,
} from './batch';

const cat = (key: string, name: string, parentKey = '', extra: Partial<CategoryDraft> = {}): CategoryDraft => ({
  key,
  id: key.startsWith('nueva-') ? null : key,
  slug: key.startsWith('nueva-') ? null : name.toLowerCase(),
  name,
  parentKey,
  description: '',
  sortOrder: '0',
  isActive: true,
  ...extra,
});

const frutas = cat('c1', 'Frutas');
const citricos = cat('c2', 'Cítricos', 'c1');
const verduras = cat('c3', 'Verduras');
const base = [frutas, citricos, verduras];

describe('validateCategories', () => {
  it('lo que ya está bien no tiene errores', () => {
    expect(validateCategories(base)).toEqual({});
  });

  it('el nombre es obligatorio, salvo en una fila nueva vacía', () => {
    expect(validateCategories([...base, cat('c4', '  ')])).toEqual({ c4: { name: 'El nombre es obligatorio.' } });
    expect(validateCategories([...base, emptyDraft(newCategoryKey(1))])).toEqual({});
  });

  it('el orden es un entero', () => {
    const e = validateCategories([cat('c1', 'Frutas', '', { sortOrder: '2,5' })]);
    expect(e.c1?.sortOrder).toMatch(/entero/);
  });

  it('la madre tiene que ser raíz: no hay tercer nivel', () => {
    const e = validateCategories([...base, cat('c4', 'Limones', 'c2')]);
    expect(e.c4?.parentKey).toMatch(/subcategoría/);
  });

  it('una categoría con hijas no puede quedar dentro de otra', () => {
    const e = validateCategories([cat('c1', 'Frutas', 'c3'), citricos, verduras]);
    expect(e.c1?.parentKey).toMatch(/Tiene subcategorías/);
  });

  it('con lo guardado, el choque de niveles se marca solo en la fila que se movió', () => {
    // A Cítricos (subcategoría de Frutas) le cuelgan una fila nueva: el error va en la nueva.
    const nueva = cat(newCategoryKey(1), 'Limones', 'c2');
    const e1 = validateCategories([...base, nueva], base);
    expect(Object.keys(e1)).toEqual([nueva.key]);
    expect(e1[nueva.key]?.parentKey).toMatch(/subcategoría/);

    // A Frutas (que tiene a Cítricos) la meten dentro de Verduras: el error va en Frutas.
    const frutasMovida = { ...frutas, parentKey: 'c3' };
    const e2 = validateCategories([frutasMovida, citricos, verduras], base);
    expect(Object.keys(e2)).toEqual(['c1']);
    expect(e2.c1?.parentKey).toMatch(/Tiene subcategorías/);
  });

  it('nadie es su propia madre, y la madre tiene que existir', () => {
    expect(validateCategories([cat('c1', 'Frutas', 'c1')]).c1?.parentKey).toMatch(/propia madre/);
    expect(validateCategories([cat('c1', 'Frutas', 'no-existe')]).c1?.parentKey).toMatch(/no existe/);
  });

  it('el nombre no se repite bajo la misma madre, sin importar tildes; bajo otra sí', () => {
    const e = validateCategories([...base, cat('c4', 'citricos', 'c1')]);
    expect(e.c4?.name).toMatch(/Ya hay/);
    expect(validateCategories([...base, cat('c4', 'Cítricos', 'c3')])).toEqual({});
  });

  it('una madre nueva sirve para una hija nueva del mismo lote', () => {
    const madre = cat(newCategoryKey(1), 'Bebidas');
    const hija = cat(newCategoryKey(2), 'Jugos', madre.key);
    expect(validateCategories([...base, madre, hija])).toEqual({});
  });

  it('cuenta los errores celda por celda', () => {
    expect(countErrors({ a: { name: 'x', sortOrder: 'y' }, b: { parentKey: 'z' } })).toBe(3);
  });
});

describe('cambios y lote', () => {
  it('solo cuentan las columnas que cambiaron', () => {
    expect(changedFields(frutas, { ...frutas, name: ' Frutas ' })).toEqual([]);
    expect(changedFields(frutas, { ...frutas, name: 'Frutas frescas', isActive: false })).toEqual(['name', 'isActive']);
    expect(changedFields(undefined, emptyDraft('nueva-1'))).toEqual([]);
  });

  it('el lote lleva las nuevas con slug libre y las editadas sin tocar su slug', () => {
    const nueva = cat(newCategoryKey(1), 'Frutas', '', { sortOrder: '' });
    const editada = { ...verduras, name: 'Verduras frescas', sortOrder: '3' };
    const lote = buildCategoryBatch(base, [frutas, citricos, editada, nueva], new Set(['frutas', 'citricos', 'verduras']));

    expect(lote).toEqual([
      expect.objectContaining({ id: 'c3', slug: null, name: 'Verduras frescas', sort_order: 3, parent_key: null }),
      expect.objectContaining({ key: 'nueva-1', id: null, slug: 'frutas-1', sort_order: 0 }),
    ]);
  });
});

describe('pegar desde Excel', () => {
  it('reparte filas y celdas, sin la fila vacía del final', () => {
    expect(parsePastedCells('Jugos\tBebidas\r\nTés\tBebidas\r\n')).toEqual([
      ['Jugos', 'Bebidas'],
      ['Tés', 'Bebidas'],
    ]);
  });

  it('interpreta Sí/No, la madre por nombre y lo que no entiende lo devuelve como error', () => {
    expect(valueFromPaste('isActive', 'Sí', base)).toEqual({ ok: true, value: true });
    expect(valueFromPaste('isActive', 'no', base)).toEqual({ ok: true, value: false });
    expect(valueFromPaste('isActive', 'quizás', base).ok).toBe(false);

    expect(valueFromPaste('parentKey', 'frutas', base)).toEqual({ ok: true, value: 'c1' });
    expect(valueFromPaste('parentKey', 'Ninguna', base)).toEqual({ ok: true, value: '' });
    // Cítricos es subcategoría: no puede ser madre.
    expect(valueFromPaste('parentKey', 'Cítricos', base).ok).toBe(false);
    expect(valueFromPaste('parentKey', 'Lácteos', base).ok).toBe(false);

    expect(valueFromPaste('name', '  Jugos ', base)).toEqual({ ok: true, value: 'Jugos' });
  });
});
