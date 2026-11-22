import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { buildPriceWorkbook, readPriceWorkbook, type PriceSheetProduct } from './price-workbook';
import { planPriceImport, type ImportTarget } from './price-import';
import type { UnitOption } from './price-grid';

const UNITS: UnitOption[] = [
  { id: 'u-kg', name: 'Kilogramo', abbreviation: 'kg' },
  { id: 'u-und', name: 'Unidad', abbreviation: 'und' },
];

const targets: ImportTarget[] = [
  {
    id: 'sp-1',
    code: '7702004003508',
    name: 'Arroz Diana',
    categoryLabel: 'Despensa › Granos',
    ivaRate: 0.05,
    values: { unitId: 'u-und', price: 3200, wsPrice: 3000, wsMin: 12, stock: 2.125, isActive: true },
  },
  {
    id: 'sp-2',
    code: 'MM-000002',
    name: 'Tomate chonto',
    ivaRate: 0,
    values: { unitId: 'u-kg', price: 0, wsPrice: null, wsMin: null, stock: 0, isActive: false },
  },
];

const products: PriceSheetProduct[] = targets.map((t) => ({
  id: t.id,
  code: t.code,
  name: t.name,
  categoryLabel: t.categoryLabel,
  unit: UNITS.find((u) => u.id === t.values.unitId)!.abbreviation,
  price: t.values.price,
  wsPrice: t.values.wsPrice,
  wsMin: t.values.wsMin,
  stock: t.values.stock,
  ivaRate: t.ivaRate,
  isActive: t.values.isActive,
}));

const exportar = (withStore = false) =>
  buildPriceWorkbook({ title: 'Mis productos', products: products.map((p) => ({ ...p, storeName: 'Tienda' })), units: UNITS, withStore });

describe('buildPriceWorkbook + readPriceWorkbook', () => {
  it('exportar y volver a importar el mismo archivo no trae cambios', async () => {
    for (const withStore of [false, true]) {
      const filas = await readPriceWorkbook(await exportar(withStore));
      expect(filas).toHaveLength(2);
      const plan = planPriceImport(filas, targets, UNITS);
      expect(plan).toMatchObject({ changes: [], errors: [], notFound: [], ignored: {} });
    }
  });

  it('lee lo que el tendero cambió en Excel', async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await exportar());
    const hoja = wb.getWorksheet('Productos')!;
    const idx = (h: string) => (hoja.getRow(1).values as string[]).indexOf(h);
    hoja.getRow(3).getCell(idx('Precio minorista')).value = 2500;
    hoja.getRow(3).getCell(idx('Stock')).value = 40;
    hoja.getRow(3).getCell(idx('Publicado')).value = 'Sí';
    hoja.getRow(2).getCell(idx('IVA')).value = '0 %';

    const plan = planPriceImport(await readPriceWorkbook(await wb.xlsx.writeBuffer()), targets, UNITS);
    expect(plan.changes).toEqual([
      { id: 'sp-2', field: 'price', value: '2500' },
      { id: 'sp-2', field: 'stock', value: '40' },
      { id: 'sp-2', field: 'isActive', value: true },
    ]);
    expect(plan.ignored).toEqual({ iva: 1 });
  });

  it('el ID va oculto, y las columnas de la tienda en verde', async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await exportar());
    const hoja = wb.getWorksheet('Productos')!;
    expect(hoja.getColumn(1).hidden).toBe(true);
    expect(wb.worksheets.map((s) => s.name)).toEqual(['Productos', 'Instrucciones', 'Listas']);
  });

  it('un archivo que no es Excel da un error que se entiende', async () => {
    await expect(readPriceWorkbook(new TextEncoder().encode('hola').buffer as ArrayBuffer)).rejects.toThrow(
      'No se pudo leer el archivo'
    );
  });

  it('un Excel sin la columna del código se rechaza', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Productos').addRow(['Nombre', 'Precio']);
    await expect(readPriceWorkbook(await wb.xlsx.writeBuffer())).rejects.toThrow('Código');
  });
});
