import ExcelJS from 'exceljs';
import { styleHeaderRow } from '@/lib/spreadsheet/workbook';
import type { ImageTarget } from './match-files';

/**
 * La lista de códigos para nombrar las fotos: código del catálogo, producto y si
 * ya tiene foto. Los que no tienen van primero, que son los que faltan.
 */
export async function buildImageCodesWorkbook(products: ImageTarget[]): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Fotos');
  sheet.columns = [
    { header: 'Código catálogo (nombre de la foto)', key: 'slug', width: 40 },
    { header: 'Producto', key: 'name', width: 40 },
    { header: '¿Tiene foto?', key: 'hasImage', width: 14 },
  ];
  styleHeaderRow(sheet, 3);

  const ordenados = [...products].sort(
    (a, b) => Number(a.hasImage) - Number(b.hasImage) || a.name.localeCompare(b.name, 'es')
  );
  for (const p of ordenados) {
    sheet.addRow({ slug: p.slug, name: p.name, hasImage: p.hasImage ? 'Sí' : 'No' });
  }

  return workbook.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}
