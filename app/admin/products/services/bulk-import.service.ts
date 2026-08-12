import type { ImportReport } from '@/lib/catalog-import/types';

async function readError(response: Response, fallback: string): Promise<string> {
  const json = await response.json().catch(() => null);
  return json?.error || fallback;
}

/**
 * Descarga la plantilla del catálogo. Va por fetch y no por un <a href> directo
 * para poder mostrar el error del servidor (403, por ejemplo) en vez de que el
 * navegador descargue un JSON de error como si fuera el Excel.
 */
export async function downloadCatalogTemplate(): Promise<void> {
  const response = await fetch('/api/products/bulk/template');

  if (!response.ok) {
    throw new Error(await readError(response, 'No se pudo generar la plantilla.'));
  }

  const blob = await response.blob();
  const fileName =
    response.headers.get('Content-Disposition')?.match(/filename="(.+?)"/)?.[1] ??
    'plantilla-catalogo.xlsx';

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

/** Con `dryRun` solo se valida: mismo endpoint y mismo código que la carga real. */
export async function uploadCatalogFile(file: File, dryRun: boolean): Promise<ImportReport> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('dry_run', String(dryRun));

  const response = await fetch('/api/products/bulk', { method: 'POST', body: formData });

  if (!response.ok) {
    throw new Error(await readError(response, 'No se pudo procesar el archivo.'));
  }

  return response.json();
}
