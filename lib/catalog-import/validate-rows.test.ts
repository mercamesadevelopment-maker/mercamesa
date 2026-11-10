import { describe, expect, it } from 'vitest';
import { validateCatalogRows, type CatalogRow } from './validate-rows';
import type { CatalogLookups } from './types';

const lookups: CatalogLookups = {
  categories: [{ id: 'cat-1', path: 'Frutas' }],
  units: [{ id: 'u-1', name: 'Kilogramo', abbreviation: 'kg', label: 'Kilogramo (kg)' }],
  storeGroups: [],
  categoryIdsByText: new Map([['frutas', ['cat-1']]]),
  unitIdsByText: new Map([['kilogramo (kg)', ['u-1']]]),
  storeGroupIdsByText: new Map(),
  existingNames: new Map(),
  existingSlugs: new Set(),
};

const fila = (n: number, extra: Partial<CatalogRow> = {}): CatalogRow =>
  ({ __row: n, name: `Producto ${n}`, category: 'Frutas', unit: 'Kilogramo (kg)', ...extra }) as CatalogRow;

describe('validateCatalogRows: IVA', () => {
  it('toma la tarifa de la lista, y vacía es 0 %', () => {
    const { valid, results } = validateCatalogRows(
      [fila(2, { iva: '19 %' }), fila(3, { iva: '5 %' }), fila(4)],
      lookups
    );
    expect(results).toEqual([]);
    expect(valid.map((v) => v.ivaRate)).toEqual([0.19, 0.05, 0]);
  });

  it('acepta lo que se pega desde otra hoja («19», «0,19»)', () => {
    const { valid } = validateCatalogRows([fila(2, { iva: '19' }), fila(3, { iva: '0,19' })], lookups);
    expect(valid.map((v) => v.ivaRate)).toEqual([0.19, 0.19]);
  });

  it('rechaza una tarifa que no existe, con su fila', () => {
    const { valid, results } = validateCatalogRows([fila(2, { iva: '7 %' })], lookups);
    expect(valid).toEqual([]);
    expect(results[0]).toMatchObject({ row: 2, status: 'failed' });
    expect(results[0].message).toContain('"IVA" solo acepta 0 %, 5 %, 19 %');
  });
});
