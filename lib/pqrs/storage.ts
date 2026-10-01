import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Las fotos de las PQRS.
 *
 * Bucket privado. El navegador nunca escribe ni lee directo: pide una URL
 * firmada de subida, sube ahí, y después el servidor mueve el archivo a la
 * carpeta del caso. Se sube así —y no pasando el archivo por la ruta— porque el
 * cuerpo de una petición en Vercel tiene tope de 4,5 MB y una foto de celular lo
 * pasa.
 *
 * Lo subido cae primero en `tmp/<usuario>/`: así una foto existe antes que el
 * caso y la radicación puede exigirla.
 */
export const PQRS_BUCKET = 'pqrs';

export const PQRS_PHOTO_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const PQRS_PHOTO_MAX_BYTES = 8 * 1024 * 1024;

/** Una hora: lo que dura abierta una pantalla de detalle sin recargar. */
const VIDA_URL_LECTURA = 60 * 60;

function carpetaTemporal(userId: string): string {
  return `tmp/${userId}/`;
}

export interface UploadTicket {
  path: string;
  token: string;
}

export async function createUploadTicket(
  service: SupabaseClient<any>,
  userId: string,
  mimeType: string
): Promise<UploadTicket> {
  const ext = PQRS_PHOTO_TYPES[mimeType];
  if (!ext) throw new Error('Solo se aceptan fotos JPG, PNG o WebP.');

  const path = `${carpetaTemporal(userId)}${crypto.randomUUID()}.${ext}`;
  const { data, error } = await service.storage.from(PQRS_BUCKET).createSignedUploadUrl(path);

  if (error || !data) throw new Error(`No se pudo preparar la subida: ${error?.message ?? ''}`);

  return { path, token: data.token };
}

/**
 * Pasa las fotos temporales a la carpeta del caso y las registra.
 *
 * Solo acepta rutas de la carpeta temporal de quien pregunta: sin eso, bastaría
 * con mandar la ruta de la foto de otro caso para apropiársela.
 */
export async function attachUploads(
  service: SupabaseClient<any>,
  params: { pqrsId: string; messageId?: string | null; userId: string; paths: string[] }
): Promise<void> {
  const { pqrsId, userId } = params;
  const prefijo = carpetaTemporal(userId);

  for (const origen of params.paths) {
    if (!origen.startsWith(prefijo) || origen.includes('..')) {
      throw new Error('Una de las fotos no es válida. Vuelve a adjuntarla.');
    }

    const destino = `${pqrsId}/${origen.slice(prefijo.length)}`;
    const { error: moveError } = await service.storage.from(PQRS_BUCKET).move(origen, destino);
    if (moveError) {
      throw new Error('Una de las fotos no terminó de subir. Vuelve a adjuntarla.');
    }

    const ext = destino.split('.').pop() ?? '';
    const mime = Object.entries(PQRS_PHOTO_TYPES).find(([, e]) => e === ext)?.[0] ?? null;

    const { error } = await service.from('pqrs_attachments').insert({
      pqrs_id: pqrsId,
      message_id: params.messageId ?? null,
      path: destino,
      mime_type: mime,
      uploaded_by: userId,
    });
    if (error) throw new Error(`No se pudo registrar la foto: ${error.message}`);
  }
}

/** URL firmada de cada ruta. Una que falle queda en `null` y la pantalla la omite. */
export async function signPaths(
  service: SupabaseClient<any>,
  paths: string[]
): Promise<Map<string, string | null>> {
  const urls = new Map<string, string | null>();
  if (paths.length === 0) return urls;

  const { data } = await service.storage.from(PQRS_BUCKET).createSignedUrls(paths, VIDA_URL_LECTURA);
  for (const fila of data ?? []) {
    if (fila.path) urls.set(fila.path, fila.error ? null : fila.signedUrl);
  }
  return urls;
}
