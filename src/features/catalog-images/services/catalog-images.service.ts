import { uploadToSignedUrl } from '@/lib/supabase/client-upload';
import { CATALOG_IMAGE_BUCKET, imageExtension } from '@/lib/catalog-images/files';
import type { ImageTarget } from '@/lib/catalog-images/match-files';

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? 'No se pudo completar.');
  return body.data as T;
}

/** Sin `storeId`, como admin del catálogo maestro. */
export async function fetchImageTargets(storeId?: string): Promise<ImageTarget[]> {
  const qs = storeId ? `?storeId=${encodeURIComponent(storeId)}` : '';
  return json<ImageTarget[]>(await fetch(`/api/catalog-images/products${qs}`));
}

/**
 * Sube una foto y la deja puesta: pide la URL firmada, sube el archivo directo a
 * Storage y confirma, que es donde se generan los derivados.
 */
export async function uploadCatalogImage(productId: string, file: File, storeId?: string): Promise<void> {
  const post = (url: string, body: object) =>
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  const ticket = await json<{ path: string; token: string }>(
    await post('/api/catalog-images/upload-url', { productId, storeId, extension: imageExtension(file.name) })
  );
  await uploadToSignedUrl(CATALOG_IMAGE_BUCKET, ticket.path, ticket.token, file);
  await json(await post('/api/catalog-images/confirm', { productId, storeId, path: ticket.path }));
}

export async function downloadImageCodes(products: ImageTarget[]): Promise<void> {
  // exceljs pesa: solo se carga cuando alguien pide la lista.
  const { buildImageCodesWorkbook } = await import('@/lib/catalog-images/codes-workbook');
  const buffer = await buildImageCodesWorkbook(products);
  const url = URL.createObjectURL(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = 'codigos-para-fotos.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}
