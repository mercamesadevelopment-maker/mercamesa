import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { buildTemplateWorkbook, EDITABLE_FIELDS } from './template';
import { parseSellerSpreadsheet } from './parse';
import { TEMPLATE_HEADERS, type TemplateField } from './constants';

const FIELDS = Object.keys(TEMPLATE_HEADERS) as TemplateField[];
const columnOf = (field: TemplateField) => FIELDS.indexOf(field) + 1;

async function plantilla() {
  const buffer = await buildTemplateWorkbook({
    storeName: 'Tienda de prueba',
    products: [
      { code: 'papa-criolla', name: 'Papa criolla', category: 'Verduras', subcategory: 'Tubérculos', unit: 'kg' },
      { code: 'cebolla-larga', name: 'Cebolla larga', category: 'Verduras', subcategory: '', unit: 'atado' },
    ],
    units: [
      { name: 'Kilogramo', abbreviation: 'kg' },
      { name: 'Atado', abbreviation: 'atado' },
    ],
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  return { buffer, workbook, sheet: workbook.getWorksheet('Productos')! };
}

const relleno = (cell: ExcelJS.Cell) => (cell.fill as ExcelJS.FillPattern | undefined)?.fgColor?.argb;

describe('plantilla de carga masiva del tendero', () => {
  it('oculta el código del catálogo, pero lo deja en el archivo', async () => {
    const { sheet } = await plantilla();
    expect(sheet.getColumn(columnOf('catalogCode')).hidden).toBe(true);
    expect(sheet.getRow(2).getCell(columnOf('catalogCode')).value).toBe('papa-criolla');
  });

  it('las columnas que llena el tendero van en lima y las de referencia no', async () => {
    const { sheet } = await plantilla();
    for (const field of EDITABLE_FIELDS) {
      expect(relleno(sheet.getRow(1).getCell(columnOf(field)))).toBe('FFC3F03F');
      expect(relleno(sheet.getRow(3).getCell(columnOf(field)))).toBe('FFEDF8D2');
    }
    for (const field of ['name', 'category', 'subcategory'] as TemplateField[]) {
      expect(relleno(sheet.getRow(2).getCell(columnOf(field)))).toBeUndefined();
    }
  });

  it('la unidad trae desplegable con las unidades', async () => {
    const { workbook, sheet } = await plantilla();
    const validacion = sheet.getRow(2).getCell(columnOf('unit')).dataValidation;
    expect(validacion?.type).toBe('list');
    const listas = workbook.getWorksheet('Listas')!;
    expect([listas.getCell('A2').value, listas.getCell('A3').value]).toEqual(['kg', 'atado']);
  });

  it('Productos sigue siendo la primera hoja', async () => {
    const { workbook } = await plantilla();
    expect(workbook.worksheets.map((s) => s.name)).toEqual(['Productos', 'Instrucciones', 'Listas']);
  });

  // Lo que importa del código oculto: al subir el archivo, el producto se sigue
  // identificando.
  it('al leerla de vuelta, cada fila trae su código del catálogo', async () => {
    const { buffer } = await plantilla();
    const filas = await parseSellerSpreadsheet(buffer, 'plantilla.xlsx');
    expect(filas.map((f) => f.catalogCode)).toEqual(['papa-criolla', 'cebolla-larga']);
  });
});
