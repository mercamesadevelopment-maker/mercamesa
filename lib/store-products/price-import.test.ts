import { describe, expect, it } from 'vitest';
import { mapHeaders, planPriceImport, summarizeImport, type ImportTarget, type SheetRow } from './price-import';
import type { UnitOption } from './price-grid';

const UNITS: UnitOption[] = [
  { id: 'u-kg', name: 'Kilogramo', abbreviation: 'kg' },
  { id: 'u-lb', name: 'Libra', abbreviation: 'lb' },
];

const papa: ImportTarget = {
  id: 'sp-1',
  code: 'MM-000001',
  name: 'Papa criolla',
  categoryLabel: 'Frutas y verduras › Tubérculos',
  ivaRate: 0,
  values: { unitId: 'u-kg', price: 4500, wsPrice: null, wsMin: null, stock: 20, isActive: true },
};
const cebolla: ImportTarget = {
  id: 'sp-2',
  code: 'MM-000002',
  name: 'Cebolla cabezona',
  ivaRate: 0.19,
  values: { unitId: 'u-lb', price: 0, wsPrice: null, wsMin: null, stock: 0, isActive: false },
};

const fila = (row: number, cells: SheetRow['cells']): SheetRow => ({ row, cells });

/** La fila tal como la exporta «Exportar Excel». */
const exportada = (t: ImportTarget, row: number): SheetRow =>
  fila(row, {
    id: t.id,
    code: t.code,
    name: t.name,
    category: t.categoryLabel ?? '',
    unit: UNITS.find((u) => u.id === t.values.unitId)!.abbreviation,
    price: t.values.price,
    wsPrice: t.values.wsPrice ?? '',
    wsMin: t.values.wsMin ?? '',
    stock: t.values.stock,
    iva: `${Math.round(t.ivaRate * 100)} %`,
    isActive: t.values.isActive ? 'Sí' : 'No',
  });

describe('planPriceImport', () => {
  it('el archivo sin tocar no trae cambios', () => {
    const plan = planPriceImport([exportada(papa, 2), exportada(cebolla, 3)], [papa, cebolla], UNITS);
    expect(plan.changes).toEqual([]);
    expect(plan.errors).toEqual([]);
    expect(plan.productsTouched).toBe(0);
    expect(plan.ignored).toEqual({});
  });

  it('trae solo las celdas que cambiaron, ya normalizadas', () => {
    const r = exportada(papa, 2);
    r.cells.price = '$ 5.200';
    r.cells.wsPrice = 4800;
    r.cells.unit = 'Libra';
    r.cells.isActive = 'NO';
    const plan = planPriceImport([r], [papa], UNITS);
    expect(plan.changes).toEqual([
      { id: 'sp-1', field: 'unit', value: 'u-lb' },
      { id: 'sp-1', field: 'price', value: '5200' },
      { id: 'sp-1', field: 'wsPrice', value: '4800' },
      { id: 'sp-1', field: 'isActive', value: false },
    ]);
    expect(plan.productsTouched).toBe(1);
  });

  it('un número que Excel guardó como número no se lee como punto de miles', () => {
    const r = exportada(papa, 2);
    r.cells.stock = 2.125; // 2,125 kg: con el lector de texto serían 2.125 unidades
    expect(planPriceImport([r], [papa], UNITS).changes).toEqual([{ id: 'sp-1', field: 'stock', value: '2.125' }]);
  });

  it('decimales escritos con coma', () => {
    const r = exportada(papa, 2);
    r.cells.stock = '12,5';
    expect(planPriceImport([r], [papa], UNITS).changes).toEqual([{ id: 'sp-1', field: 'stock', value: '12.5' }]);
  });

  it('acepta sí, SI y verdadero de Excel', () => {
    for (const v of ['sí', 'SI', true] as const) {
      const r = exportada(cebolla, 2);
      r.cells.isActive = v;
      expect(planPriceImport([r], [cebolla], UNITS).changes).toEqual([{ id: 'sp-2', field: 'isActive', value: true }]);
    }
  });

  it('lo ilegible queda como error de su celda y lo demás se carga', () => {
    const r = exportada(papa, 2);
    r.cells.stock = 'doce';
    r.cells.price = 5000;
    const plan = planPriceImport([r], [papa], UNITS);
    expect(plan.errors).toEqual([{ id: 'sp-1', field: 'stock', error: '«doce» no es un número.' }]);
    expect(plan.changes).toEqual([{ id: 'sp-1', field: 'price', value: '5000' }]);
  });

  it('producto, categoría e IVA cambiados no se aplican, y se cuentan', () => {
    const r = exportada(papa, 2);
    r.cells.name = 'Papa pastusa';
    r.cells.category = 'Otra';
    r.cells.iva = '19 %';
    const plan = planPriceImport([r], [papa], UNITS);
    expect(plan.changes).toEqual([]);
    expect(plan.ignored).toEqual({ name: 1, category: 1, iva: 1 });
  });

  it('sin la columna ID encuentra el producto por el código', () => {
    const r = exportada(papa, 2);
    delete r.cells.id;
    r.cells.code = 'mm-000001';
    r.cells.price = 4700;
    expect(planPriceImport([r], [papa], UNITS).changes).toEqual([{ id: 'sp-1', field: 'price', value: '4700' }]);
  });

  it('un código repetido entre tiendas no sirve de llave', () => {
    const otra = { ...papa, id: 'sp-9' };
    const r = exportada(papa, 2);
    delete r.cells.id;
    expect(planPriceImport([r], [papa, otra], UNITS).notFound).toEqual([2]);
  });

  it('las filas de otra tienda o con un código que no existe no cambian nada', () => {
    const ajena = fila(5, { id: 'sp-de-otra-tienda', code: 'XX-1', price: 1 });
    const plan = planPriceImport([ajena], [papa], UNITS);
    expect(plan.changes).toEqual([]);
    expect(plan.notFound).toEqual([5]);
  });

  it('el mismo producto en dos filas: vale la primera', () => {
    const a = exportada(papa, 2);
    a.cells.price = 5000;
    const b = exportada(papa, 3);
    b.cells.price = 9999;
    const plan = planPriceImport([a, b], [papa], UNITS);
    expect(plan.changes).toEqual([{ id: 'sp-1', field: 'price', value: '5000' }]);
    expect(plan.duplicated).toEqual([3]);
  });

  it('una columna que no viene no se toca, y la unidad vacía no se borra', () => {
    const plan = planPriceImport([fila(2, { id: 'sp-1', unit: '', price: 4500 })], [papa], UNITS);
    expect(plan.changes).toEqual([]);
    expect(plan.errors).toEqual([]);
  });

  it('las filas vacías se saltan', () => {
    expect(planPriceImport([fila(9, { id: '', code: '', price: '' })], [papa], UNITS).notFound).toEqual([]);
  });
});

describe('mapHeaders', () => {
  it('reconoce encabezados sin tildes, en otro orden y con alias', () => {
    const m = mapHeaders(['Notas', 'STOCK', 'codigo', 'Min mayorista', 'Precio', 'publicado']);
    expect([...m.entries()]).toEqual([
      [1, 'stock'],
      [2, 'code'],
      [3, 'wsMin'],
      [4, 'price'],
      [5, 'isActive'],
    ]);
  });
});

describe('summarizeImport', () => {
  it('sin cambios lo dice', () => {
    const plan = planPriceImport([exportada(papa, 2)], [papa], UNITS);
    expect(summarizeImport(plan)).toEqual({ title: 'El archivo no trae cambios respecto a lo que ya tienes.', notes: [] });
  });

  it('cuenta cambios, errores, columnas ignoradas y filas ajenas', () => {
    const r = exportada(papa, 2);
    r.cells.price = 5000;
    r.cells.stock = 'doce';
    r.cells.iva = '19 %';
    const plan = planPriceImport([r, fila(7, { id: 'x', price: 1 })], [papa], UNITS);
    const s = summarizeImport(plan);
    expect(s.title).toContain('Se cargaron 1 cambio en 1 producto');
    expect(s.notes).toEqual([
      '1 celda no se pudo leer: quedaron marcadas en rojo para que las corrijas.',
      'Cambiaste «IVA»: son del catálogo de MercaMesa y no se aplicaron.',
      'La fila 7 no es de tus productos y se ignoró.',
    ]);
  });
});
