import type { ImportPlan, ImportTarget } from '@/lib/store-products/price-import';
import type { PriceSheetProduct } from '@/lib/store-products/price-workbook';
import type { UnitOption } from '@/lib/store-products/price-grid';

/**
 * Exportar e importar el Excel de «Mis productos». Todo pasa en el navegador:
 * los productos ya están cargados en la tabla, y lo importado se vuelca en ella
 * sin escribir nada hasta que el tendero le da «Guardar».
 *
 * `exceljs` pesa: se carga solo cuando alguien exporta o importa.
 */

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function exportPriceWorkbook(input: {
  fileName: string;
  title: string;
  products: PriceSheetProduct[];
  units: UnitOption[];
  withStore: boolean;
}): Promise<void> {
  const { buildPriceWorkbook } = await import('@/lib/store-products/price-workbook');
  const buffer = await buildPriceWorkbook(input);
  const url = URL.createObjectURL(new Blob([buffer], { type: XLSX_MIME }));
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = input.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function importPriceWorkbook(file: File, targets: ImportTarget[], units: UnitOption[]): Promise<ImportPlan> {
  const [{ readPriceWorkbook, PRICE_WORKBOOK_MAX_BYTES }, { planPriceImport }] = await Promise.all([
    import('@/lib/store-products/price-workbook'),
    import('@/lib/store-products/price-import'),
  ]);
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    throw new Error('El archivo debe ser un Excel (.xlsx). Si lo guardaste en otro formato, ábrelo y guárdalo como .xlsx.');
  }
  if (file.size > PRICE_WORKBOOK_MAX_BYTES) {
    throw new Error(`El archivo pesa más de ${Math.round(PRICE_WORKBOOK_MAX_BYTES / 1024 / 1024)} MB.`);
  }
  const filas = await readPriceWorkbook(await file.arrayBuffer());
  return planPriceImport(filas, targets, units);
}
