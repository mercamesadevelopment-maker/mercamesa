import type { SupabaseClient } from '@supabase/supabase-js';
import { getMeteorMediaHosts } from '@/lib/env';
import { PHOTO_MAX_BYTES, PHOTO_TYPES } from '@/lib/storage/photo-rules';
import { PQRS_BUCKET } from '@/lib/pqrs/storage';

/**
 * Las fotos que la persona manda por WhatsApp, para un caso de PQRSF.
 *
 * Meteor las guarda y manda su URL. El servidor las descarga y las deja en la
 * carpeta temporal de la persona en el bucket `pqrs` (`tmp/<usuario>/`), igual
 * que si las hubiera subido desde la app; de ahí `createPqrs` y
 * `addPqrsMessage` las pasan al caso con sus reglas de siempre.
 *
 * Solo se descarga de los dominios de `METEOR_MEDIA_HOSTS`, por https y sin
 * seguir redirecciones: si no, cualquiera podría poner al servidor a pedir
 * direcciones internas o sitios ajenos.
 */

export class ChatPhotoError extends Error {}

const TIEMPO_MAXIMO_MS = 15000;

/** Si la URL es https y de un dominio permitido (o un subdominio suyo). Sin red. */
export function isAllowedMediaUrl(url: string, hosts: string[]): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return false;
  const host = u.hostname.toLowerCase();
  return hosts.some((h) => host === h || host.endsWith(`.${h}`));
}

/** El tipo declarado de la respuesta, sin parámetros: `image/jpeg; charset=…` → `image/jpeg`. */
export function photoTypeOf(contentType: string | null): string | null {
  const tipo = (contentType ?? '').split(';')[0].trim().toLowerCase();
  return PHOTO_TYPES[tipo] ? tipo : null;
}

async function descargar(url: string): Promise<{ bytes: ArrayBuffer; type: string }> {
  let res: Response;
  try {
    res = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS) });
  } catch {
    throw new ChatPhotoError('No se pudo descargar una de las fotos. Pídele que la envíe de nuevo.');
  }
  if (!res.ok) throw new ChatPhotoError('No se pudo descargar una de las fotos. Pídele que la envíe de nuevo.');

  const type = photoTypeOf(res.headers.get('content-type'));
  if (!type) throw new ChatPhotoError('Solo se aceptan fotos JPG, PNG o WebP.');
  if (Number(res.headers.get('content-length') ?? 0) > PHOTO_MAX_BYTES) {
    throw new ChatPhotoError('Cada foto puede pesar hasta 8 MB.');
  }
  const bytes = await res.arrayBuffer();
  if (bytes.byteLength === 0 || bytes.byteLength > PHOTO_MAX_BYTES) {
    throw new ChatPhotoError('Cada foto puede pesar hasta 8 MB.');
  }
  return { bytes, type };
}

/**
 * Descarga las fotos y las deja en `tmp/<usuario>/`. Devuelve las rutas, que
 * son las que reciben `createPqrs` y `addPqrsMessage`.
 */
export async function importChatPhotos(
  service: SupabaseClient<any>,
  userId: string,
  urls: string[]
): Promise<string[]> {
  if (urls.length === 0) return [];
  const hosts = getMeteorMediaHosts();
  if (hosts.length === 0) {
    throw new ChatPhotoError('Por ahora las fotos no se reciben por el chat: la persona puede adjuntarlas desde MercaMesa.');
  }
  if (!urls.every((u) => isAllowedMediaUrl(u, hosts))) {
    throw new ChatPhotoError('Una de las fotos no viene del almacenamiento de Meteor.');
  }

  const rutas: string[] = [];
  for (const url of urls) {
    const { bytes, type } = await descargar(url);
    const path = `tmp/${userId}/${crypto.randomUUID()}.${PHOTO_TYPES[type]}`;
    const { error } = await service.storage.from(PQRS_BUCKET).upload(path, bytes, { contentType: type });
    if (error) throw new Error(`No se pudo guardar la foto: ${error.message}`);
    rutas.push(path);
  }
  return rutas;
}
