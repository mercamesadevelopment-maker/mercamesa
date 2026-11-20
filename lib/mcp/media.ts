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
 * Solo se descarga de los dominios de `METEOR_MEDIA_HOSTS`, por https, y una
 * redirección se sigue solo si va a otro dominio de la lista: si no, cualquiera
 * podría poner al servidor a pedir direcciones internas o sitios ajenos.
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

/** Hasta cuántas redirecciones se siguen. El enlace de Meteor da una: a la URL firmada de su almacenamiento. */
export const MAX_REDIRECCIONES = 2;

const NO_SE_PUDO = 'No se pudo descargar una de las fotos. Pídele que la envíe de nuevo.';
const MUY_GRANDE = 'Cada foto puede pesar hasta 8 MB.';

/**
 * Baja una foto. El enlace permanente de Meteor redirige (302) a una URL firmada
 * de su almacenamiento: la redirección se sigue a mano, un salto a la vez, y
 * cada destino tiene que ser https y de un dominio permitido. Si `fetch` la
 * siguiera solo, un enlace podría terminar en una dirección interna.
 *
 * El tamaño se corta mientras se lee: no se confía en `content-length`, que
 * puede no venir.
 */
export async function downloadChatPhoto(
  url: string,
  hosts: string[],
  fetchImpl: typeof fetch = fetch
): Promise<{ bytes: Uint8Array; type: string }> {
  const signal = AbortSignal.timeout(TIEMPO_MAXIMO_MS);
  let actual = url;
  let res: Response | null = null;

  for (let salto = 0; salto <= MAX_REDIRECCIONES; salto++) {
    if (!isAllowedMediaUrl(actual, hosts)) {
      throw new ChatPhotoError('Una de las fotos no viene del almacenamiento de Meteor.');
    }
    try {
      res = await fetchImpl(actual, { redirect: 'manual', signal });
    } catch {
      throw new ChatPhotoError(NO_SE_PUDO);
    }
    if (res.status < 300 || res.status >= 400) break;

    const location = res.headers.get('location');
    if (!location || salto === MAX_REDIRECCIONES) throw new ChatPhotoError(NO_SE_PUDO);
    try {
      actual = new URL(location, actual).toString();
    } catch {
      throw new ChatPhotoError(NO_SE_PUDO);
    }
    res = null;
  }

  if (!res || !res.ok || !res.body) throw new ChatPhotoError(NO_SE_PUDO);

  const type = photoTypeOf(res.headers.get('content-type'));
  if (!type) throw new ChatPhotoError('Solo se aceptan fotos JPG, PNG o WebP.');
  if (Number(res.headers.get('content-length') ?? 0) > PHOTO_MAX_BYTES) throw new ChatPhotoError(MUY_GRANDE);

  const partes: Uint8Array[] = [];
  let total = 0;
  const reader = res.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > PHOTO_MAX_BYTES) {
        await reader.cancel();
        throw new ChatPhotoError(MUY_GRANDE);
      }
      partes.push(value);
    }
  } catch (error) {
    if (error instanceof ChatPhotoError) throw error;
    throw new ChatPhotoError(NO_SE_PUDO);
  }
  if (total === 0) throw new ChatPhotoError(NO_SE_PUDO);

  const bytes = new Uint8Array(total);
  let pos = 0;
  for (const p of partes) {
    bytes.set(p, pos);
    pos += p.byteLength;
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
    const { bytes, type } = await downloadChatPhoto(url, hosts);
    const path = `tmp/${userId}/${crypto.randomUUID()}.${PHOTO_TYPES[type]}`;
    const { error } = await service.storage.from(PQRS_BUCKET).upload(path, bytes, { contentType: type });
    if (error) throw new Error(`No se pudo guardar la foto: ${error.message}`);
    rutas.push(path);
  }
  return rutas;
}
