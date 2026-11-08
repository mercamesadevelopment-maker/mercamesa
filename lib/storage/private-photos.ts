import type { SupabaseClient } from '@supabase/supabase-js';
import { PHOTO_TYPES } from './photo-rules';

/**
 * Fotos en un bucket privado (PQRS, recepción en la bahía).
 *
 * El navegador nunca escribe ni lee directo: pide una URL firmada de subida,
 * sube ahí, y después el servidor mueve el archivo a la carpeta de lo que
 * documenta. Se sube así —y no pasando el archivo por la ruta— porque el cuerpo
 * de una petición en Vercel tiene tope de 4,5 MB y una foto de celular lo pasa.
 *
 * Lo subido cae primero en `tmp/<usuario>/`: así la foto existe antes que el
 * registro y este puede exigirla.
 */

/** Una hora: lo que dura abierta una pantalla de detalle sin recargar. */
const VIDA_URL_LECTURA = 60 * 60;

export const FOTO_NO_VALIDA = 'Una de las fotos no es válida. Vuelve a adjuntarla.';
export const FOTO_SIN_SUBIR = 'Una de las fotos no terminó de subir. Vuelve a adjuntarla.';

export interface UploadTicket {
  path: string;
  token: string;
}

function carpetaTemporal(userId: string): string {
  return `tmp/${userId}/`;
}

export function mimeOfPath(path: string): string | null {
  const ext = path.split('.').pop() ?? '';
  return Object.entries(PHOTO_TYPES).find(([, e]) => e === ext)?.[0] ?? null;
}

export async function createPhotoUploadTicket(
  service: SupabaseClient<any>,
  bucket: string,
  userId: string,
  mimeType: string
): Promise<UploadTicket> {
  const ext = PHOTO_TYPES[mimeType];
  if (!ext) throw new Error('Solo se aceptan fotos JPG, PNG o WebP.');

  const path = `${carpetaTemporal(userId)}${crypto.randomUUID()}.${ext}`;
  const { data, error } = await service.storage.from(bucket).createSignedUploadUrl(path);

  if (error || !data) throw new Error(`No se pudo preparar la subida: ${error?.message ?? ''}`);

  return { path, token: data.token };
}

/**
 * ¿Todas las rutas son de la carpeta temporal de quien pregunta?
 *
 * Sin esta comprobación bastaría con mandar la ruta de la foto de otro para
 * apropiársela. Se comprueba ANTES de escribir nada: un intento con rutas
 * ajenas no deja rastro.
 */
export function areOwnUploads(userId: string, paths: unknown[]): paths is string[] {
  const prefijo = carpetaTemporal(userId);
  return paths.every(
    (p) => typeof p === 'string' && p.startsWith(prefijo) && !p.includes('..') && !p.slice(prefijo.length).includes('/')
  );
}

/**
 * Pasa las fotos temporales de quien las subió a `folder/` y devuelve dónde
 * quedó cada una. Quien llama las registra en su tabla.
 */
export async function movePhotos(
  service: SupabaseClient<any>,
  bucket: string,
  params: { userId: string; paths: string[]; folder: string }
): Promise<{ path: string; mimeType: string | null }[]> {
  const prefijo = carpetaTemporal(params.userId);
  if (!areOwnUploads(params.userId, params.paths)) throw new Error(FOTO_NO_VALIDA);

  const movidas: { path: string; mimeType: string | null }[] = [];
  for (const origen of params.paths) {
    const destino = `${params.folder}/${origen.slice(prefijo.length)}`;
    const { error } = await service.storage.from(bucket).move(origen, destino);
    if (error) throw new Error(FOTO_SIN_SUBIR);
    movidas.push({ path: destino, mimeType: mimeOfPath(destino) });
  }
  return movidas;
}

/** URL firmada de cada ruta. Una que falle queda en `null` y la pantalla la omite. */
export async function signPhotoPaths(
  service: SupabaseClient<any>,
  bucket: string,
  paths: string[]
): Promise<Map<string, string | null>> {
  const urls = new Map<string, string | null>();
  if (paths.length === 0) return urls;

  const { data } = await service.storage.from(bucket).createSignedUrls(paths, VIDA_URL_LECTURA);
  for (const fila of data ?? []) {
    if (fila.path) urls.set(fila.path, fila.error ? null : fila.signedUrl);
  }
  return urls;
}
