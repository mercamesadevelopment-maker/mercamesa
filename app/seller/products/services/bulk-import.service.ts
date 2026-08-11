import type { ImportReport } from '../types/bulk-import.types';

async function readError(response: Response, fallback: string): Promise<string> {
  const json = await response.json().catch(() => null);
  return json?.error || fallback;
}

/**
 * Descarga la plantilla del catálogo. Va por fetch y no por un <a href> directo
 * para poder mostrar el error del servidor (403, por ejemplo) en vez de que el
 * navegador descargue un JSON de error como si fuera el Excel.
 */
export async function downloadTemplate(storeId: string): Promise<void> {
  const response = await fetch(
    `/api/store-products/bulk/template?store_id=${encodeURIComponent(storeId)}`
  );

  if (!response.ok) {
    throw new Error(await readError(response, 'No se pudo generar la plantilla.'));
  }

  const blob = await response.blob();
  const fileName =
    response.headers.get('Content-Disposition')?.match(/filename="(.+?)"/)?.[1] ??
    'plantilla-productos.xlsx';

  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Sube el archivo. Con `dryRun` solo se valida y no se escribe nada: es el
 * mismo endpoint y el mismo código, así que la previsualización no puede
 * diferir del resultado real.
 */
export async function uploadBulkFile(
  storeId: string,
  file: File,
  dryRun: boolean
): Promise<ImportReport> {
  const formData = new FormData();
  formData.append('store_id', storeId);
  formData.append('file', file);
  formData.append('dry_run', String(dryRun));

  const response = await fetch('/api/store-products/bulk', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await readError(response, 'No se pudo procesar el archivo.'));
  }

  return response.json();
}
