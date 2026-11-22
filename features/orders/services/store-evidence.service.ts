import { LOGISTICS_BUCKET } from '@/lib/logistics/bucket';
import { uploadToSignedUrl } from '@/lib/supabase/client-upload';
import type { StoreEvidence } from '@/lib/orders/store-evidence';

async function leer(res: Response): Promise<any> {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? 'No pudimos completar la operación.');
  return json;
}

/** Si al marcar «Listo Recogida» esta parte pide fotos del tendero, y la evidencia que ya hay. */
export async function fetchStoreEvidenceStatus(
  storeOrderId: string
): Promise<{ required: boolean; evidence: StoreEvidence | null }> {
  const json = await leer(await fetch(`/api/store-orders/${encodeURIComponent(storeOrderId)}/evidence`));
  return json.data;
}

/**
 * Sube las fotos directo al bucket privado, con un permiso firmado por foto, y
 * devuelve sus rutas temporales: son las que se mandan con el cambio de estado.
 */
export async function uploadStoreEvidencePhotos(storeOrderId: string, files: File[]): Promise<string[]> {
  if (files.length === 0) return [];
  const json = await leer(
    await fetch(`/api/store-orders/${encodeURIComponent(storeOrderId)}/evidence/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: files.map((f) => ({ type: f.type, size: f.size })) }),
    })
  );
  const tickets = json.data as { path: string; token: string }[];
  await Promise.all(tickets.map((t, i) => uploadToSignedUrl(LOGISTICS_BUCKET, t.path, t.token, files[i])));
  return tickets.map((t) => t.path);
}
