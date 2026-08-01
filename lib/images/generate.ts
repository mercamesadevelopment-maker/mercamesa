/**
 * lib/images/generate.ts
 *
 * Generación de derivados WebP con `sharp`. Solo se importa desde
 * código de servidor (route handlers, scripts) — nunca desde componentes
 * de cliente.
 */
import sharp from 'sharp';
import type { SupabaseClient } from '@supabase/supabase-js';
import { IMAGE_VARIANTS, ImageVariant, derivativePath } from './variants';

export async function generateVariantBuffer(source: Buffer, variant: ImageVariant): Promise<Buffer> {
  const spec = IMAGE_VARIANTS[variant];
  return sharp(source)
    .resize(spec.width, spec.height, { fit: 'cover', position: 'centre' })
    .webp({ quality: spec.quality })
    .toBuffer();
}

/**
 * Genera y sube los derivados de una imagen ya subida (el original no se toca).
 * `upsert: true` para que sea seguro reintentar/reemplazar.
 */
export async function uploadVariants(
  supabase: SupabaseClient<any>,
  bucket: string,
  originalPath: string,
  source: Buffer,
  variants: ImageVariant[]
): Promise<void> {
  for (const variant of variants) {
    let buffer: Buffer;
    try {
      buffer = await generateVariantBuffer(source, variant);
    } catch (err) {
      // Formato que sharp no puede procesar (ej. HEIC no soportado, SVG, archivo corrupto):
      // no se genera ese derivado, el <img> caerá al original vía el fallback onError.
      console.error(`No se pudo generar el derivado "${variant}" para ${bucket}/${originalPath}:`, err);
      continue;
    }

    const path = derivativePath(originalPath, variant);
    // Se sube como Blob (no como Buffer crudo): @supabase/storage-js envía un
    // Buffer directo como body de fetch, y el fetch global parcheado por
    // Next.js (Data Cache) corrompe bodies binarios en esa ruta. Un Blob
    // fuerza que storage-js lo envíe como FormData, evitando el problema.
    const blob = new Blob([Uint8Array.from(buffer)], { type: 'image/webp' });
    const { error } = await supabase.storage.from(bucket).upload(path, blob, {
      cacheControl: '31536000',
      upsert: true,
    });

    if (error) {
      console.error(`No se pudo subir el derivado "${variant}" para ${bucket}/${originalPath}:`, error.message);
    }
  }
}

/**
 * Borra el original y todos sus derivados. Se usa al reemplazar una imagen
 * o al eliminar el recurso dueño, para no acumular huérfanos en el bucket.
 */
export async function removeImageAndVariants(
  supabase: SupabaseClient<any>,
  bucket: string,
  originalPath: string,
  variants: ImageVariant[]
): Promise<void> {
  const paths = [originalPath, ...variants.map((v) => derivativePath(originalPath, v))];
  const { error } = await supabase.storage.from(bucket).remove(paths);
  if (error) {
    console.error(`No se pudieron borrar los archivos de ${bucket}/${originalPath}:`, error.message);
  }
}
