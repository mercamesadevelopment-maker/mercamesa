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
  // DEBUG temporal: validar el buffer fuente antes de generar cualquier derivado.
  try {
    const originalMeta = await sharp(source).metadata();
    console.log('[uploadVariants] DEBUG source', {
      bucket,
      originalPath,
      sourceBytes: source.length,
      originalMeta,
    });
  } catch (err) {
    console.error('[uploadVariants] DEBUG source buffer is NOT a valid image', {
      bucket,
      originalPath,
      sourceBytes: source.length,
      err: err instanceof Error ? err.message : err,
    });
  }

  for (const variant of variants) {
    let buffer: Buffer;
    try {
      buffer = await generateVariantBuffer(source, variant);

      // DEBUG temporal: validar el derivado generado antes de subirlo.
      try {
        const meta = await sharp(buffer).metadata();
        console.log('[uploadVariants] DEBUG generated variant', {
          variant,
          bytes: buffer.length,
          meta,
        });
      } catch (metaErr) {
        console.error('[uploadVariants] DEBUG generated variant is CORRUPT right after generateVariantBuffer', {
          variant,
          bytes: buffer.length,
          err: metaErr instanceof Error ? metaErr.message : metaErr,
        });
      }
    } catch (err) {
      // Formato que sharp no puede procesar (ej. HEIC no soportado, SVG, archivo corrupto):
      // no se genera ese derivado, el <img> caerá al original vía el fallback onError.
      console.error(`No se pudo generar el derivado "${variant}" para ${bucket}/${originalPath}:`, err);
      continue;
    }

    const path = derivativePath(originalPath, variant);
    const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
      contentType: 'image/webp',
      cacheControl: '31536000',
      upsert: true,
    });

    if (error) {
      console.error(`No se pudo subir el derivado "${variant}" para ${bucket}/${originalPath}:`, error.message);
    } else {
      console.log('[uploadVariants] DEBUG uploaded variant OK', { variant, path, bytes: buffer.length });
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
