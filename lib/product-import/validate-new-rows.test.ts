import { describe, expect, it } from 'vitest';
import { validateNewRows } from './validate-new-rows';
import { validateRows } from './validate-rows';
import type { NewProductRow, SellerRow } from './parse';
import type { ImportLookups } from './types';

function lookups(overrides: Partial<ImportLookups> = {}): ImportLookups {
  return {
    catalogBySlug: new Map([
      ['papa-criolla', { id: 'cat-papa', name: 'Papa criolla', defaultUnitId: 'u-kg', usable: true }],
    ]),
    visibleNames: new Map([['papa criolla', 'Papa criolla']]),
    existingSlugs: new Set(['papa-criolla', 'guayaba-agria']),
    categoryIdsByText: new Map([
      ['frutas', ['c-frutas']],
      ['verduras > hojas', ['c-verduras-hojas']],
      ['aromaticas > hojas', ['c-aromaticas-hojas']],
      ['hojas', ['c-verduras-hojas', 'c-aromaticas-hojas']],
    ]),
    storeGroupId: null,
    unitIdsByText: new Map([['kg', ['u-kg']], ['atado', ['u-atado']]]),
    existingCatalogProductIds: new Set(),
    existingProductCodes: new Set(['YA-USADO']),
    catalogSize: 10,
    ...overrides,
  };
}

const fila = (row: number, values: Partial<NewProductRow>): NewProductRow => ({
  __row: row,
  name: 'Guayaba agria',
  category: 'Frutas',
  unit: 'kg',
  productCode: `G-${row}`,
  retailPrice: '3.500',
  stock: '12',
  ...values,
});

describe('validateNewRows', () => {
  it('una fila completa queda lista para crear el producto y publicarlo', () => {
    const { valid, results } = validateNewRows([fila(2, {})], lookups(), new Map());
    expect(results).toEqual([]);
    expect(valid).toHaveLength(1);
    expect(valid[0]).toMatchObject({
      name: 'Guayaba agria',
      categoryId: 'c-frutas',
      unitId: 'u-kg',
      productCode: 'G-2',
      pricePerUnit: 3500,
      stock: 12,
      minOrderQty: 1,
      // El slug se genera solo y no choca con uno que ya existe.
      slug: 'guayaba-agria-1',
    });
    expect(valid[0].siigoId).toBeTruthy();
  });

  it('ignora las filas vacías de la plantilla', () => {
    const { valid, results } = validateNewRows([{ __row: 2 }, { __row: 3, description: '  ' }], lookups(), new Map());
    expect(valid).toEqual([]);
    expect(results).toEqual([]);
  });

  it('si el producto ya está en el catálogo, manda a buscarlo en la hoja Productos', () => {
    const { results } = validateNewRows([fila(2, { name: 'PAPA  CRIOLLA' })], lookups(), new Map());
    expect(results[0]).toMatchObject({ status: 'failed', sheet: 'new' });
    expect(results[0].message).toContain('hoja "Productos"');
  });

  it('no deja el mismo producto dos veces en la hoja', () => {
    const { valid, results } = validateNewRows(
      [fila(2, {}), fila(3, { name: 'guayaba agria' })],
      lookups(),
      new Map()
    );
    expect(valid).toHaveLength(1);
    expect(results[0].message).toContain('fila 2');
  });

  it('la categoría tiene que existir, y si se repite el nombre pide la ruta', () => {
    const { results } = validateNewRows(
      [fila(2, { category: 'Inventada' }), fila(3, { name: 'Espinaca', category: 'Hojas' })],
      lookups(),
      new Map()
    );
    expect(results[0].message).toContain('no existe');
    expect(results[1].message).toContain('Padre > Hojas');
  });

  it('acepta la categoría escrita con la ruta completa', () => {
    const { valid } = validateNewRows([fila(2, { name: 'Espinaca', category: 'verduras > hojas' })], lookups(), new Map());
    expect(valid[0].categoryId).toBe('c-verduras-hojas');
  });

  it('en un producto nuevo la unidad es obligatoria', () => {
    const { results } = validateNewRows([fila(2, { unit: '' })], lookups(), new Map());
    expect(results[0].message).toContain('Unidad');
  });

  it('el código no puede repetir uno de la hoja Productos ni uno ya publicado', () => {
    const vistos = new Map<string, string>();
    const catalogo: SellerRow[] = [
      { __row: 2, catalogCode: 'papa-criolla', productCode: 'C-1', retailPrice: '2000', stock: '5' },
    ];
    expect(validateRows(catalogo, lookups(), vistos).valid).toHaveLength(1);

    const { results } = validateNewRows(
      [fila(2, { productCode: 'c-1' }), fila(3, { name: 'Lulo', productCode: 'ya-usado' })],
      lookups(),
      vistos
    );
    expect(results[0].message).toContain('la fila 2 del archivo');
    expect(results[1].message).toBeTruthy();
    expect(results).toHaveLength(2);
  });

  it('el precio mayorista no puede superar al minorista', () => {
    const { results } = validateNewRows([fila(2, { wholesalePrice: '5000' })], lookups(), new Map());
    expect(results[0].message).toContain('mayorista');
  });
});
