/**
 * lib/supabase/supabase-image.ts
 *
 * Utilidad para construir URLs de imágenes optimizadas.
 *
 * Antes usaba Supabase Storage Image Transformations (/render/image/public/),
 * pero esas transformaciones se facturan por "origin image" procesada
 * (100 incluidas en el plan Pro, luego $5 por cada 1.000) — un techo que no
 * depende del tráfico sino de cuántas imágenes distintas tiene el catálogo,
 * y que ya se agotó una vez. Ahora los derivados WebP se generan una sola
 * vez al subir la imagen (ver lib/images/generate.ts) y se sirven como
 * objetos públicos normales (/storage/v1/object/public/), lo cual solo
 * consume storage y egress, sin ningún cupo de transformaciones de por medio.
 */
import { ImageVariant, derivativePath } from '@/lib/images/variants';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

// Se conservan estos nombres por compatibilidad con los call sites existentes;
// ahora son simples alias del nombre de la variante en lib/images/variants.ts.
export const PRESET_THUMBNAIL: ImageVariant = 'thumb';
export const PRESET_PRODUCT_CARD: ImageVariant = 'card';
export const PRESET_LOGO: ImageVariant = 'logo';
export const PRESET_COVER: ImageVariant = 'cover';
export const PRESET_COVER_DETAIL: ImageVariant = 'cover';

/**
 * Devuelve la URL pública de una imagen almacenada en Supabase Storage.
 *
 * Sin `variant`: URL pública directa del original.
 * Con `variant`: URL pública del derivado WebP pre-generado correspondiente.
 *
 * @param bucket - Nombre del bucket de Supabase Storage
 * @param path   - Ruta al archivo original dentro del bucket (ej: "imgs/uuid/img.jpg")
 * @param variant - Variante deseada (ver lib/images/variants.ts)
 */
export function getSupabaseImageUrl(
  bucket: string,
  path: string,
  variant?: ImageVariant
): string {
  if (!path) return '';
  if (!SUPABASE_URL) return '';

  const base = SUPABASE_URL.replace(/\/$/, '');
  const finalPath = variant ? derivativePath(path, variant) : path;

  return `${base}/storage/v1/object/public/${bucket}/${finalPath}`;
}
