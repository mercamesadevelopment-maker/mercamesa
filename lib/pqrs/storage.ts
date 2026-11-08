import type { SupabaseClient } from '@supabase/supabase-js';
import { PHOTO_MAX_BYTES, PHOTO_TYPES } from '@/lib/storage/photo-rules';
import {
  areOwnUploads as sonPropias,
  createPhotoUploadTicket,
  FOTO_NO_VALIDA,
  movePhotos,
  signPhotoPaths,
  type UploadTicket,
} from '@/lib/storage/private-photos';

/**
 * Las fotos de las PQRS, en el bucket privado `pqrs`. El mecanismo (subida
 * firmada a `tmp/<usuario>/` y después a la carpeta del caso) está en
 * `lib/storage/private-photos.ts`.
 */
export const PQRS_BUCKET = 'pqrs';

export const PQRS_PHOTO_TYPES = PHOTO_TYPES;
export const PQRS_PHOTO_MAX_BYTES = PHOTO_MAX_BYTES;

export { FOTO_NO_VALIDA };
export type { UploadTicket };

export function createUploadTicket(
  service: SupabaseClient<any>,
  userId: string,
  mimeType: string
): Promise<UploadTicket> {
  return createPhotoUploadTicket(service, PQRS_BUCKET, userId, mimeType);
}

/** ¿Todas las rutas son de la carpeta temporal de quien pregunta? */
export function areOwnUploads(userId: string, paths: string[]): boolean {
  return sonPropias(userId, paths);
}

/** Pasa las fotos temporales a la carpeta del caso y las registra. */
export async function attachUploads(
  service: SupabaseClient<any>,
  params: { pqrsId: string; messageId?: string | null; userId: string; paths: string[] }
): Promise<void> {
  const movidas = await movePhotos(service, PQRS_BUCKET, {
    userId: params.userId,
    paths: params.paths,
    folder: params.pqrsId,
  });

  for (const foto of movidas) {
    const { error } = await service.from('pqrs_attachments').insert({
      pqrs_id: params.pqrsId,
      message_id: params.messageId ?? null,
      path: foto.path,
      mime_type: foto.mimeType,
      uploaded_by: params.userId,
    });
    if (error) throw new Error(`No se pudo registrar la foto: ${error.message}`);
  }
}

/** URL firmada de cada ruta. Una que falle queda en `null` y la pantalla la omite. */
export function signPaths(service: SupabaseClient<any>, paths: string[]): Promise<Map<string, string | null>> {
  return signPhotoPaths(service, PQRS_BUCKET, paths);
}
