/**
 * lib/supabase/supabase-image.ts
 *
 * Utilidad para construir URLs de imágenes optimizadas usando
 * Supabase Storage Image Transformations (Pro plan).
 *
 * Docs: https://supabase.com/docs/guides/storage/serving/image-transformations
 *
 * Las transformaciones se cachean en Supabase, por lo que cada combinación
 * única de (bucket, path, opciones) sólo se procesa una vez.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

export interface SupabaseImageTransformOptions {
  width?: number;
  height?: number;
  quality?: number;
  resize?: 'cover' | 'contain' | 'fill';
}

/**
 * Devuelve la URL de una imagen almacenada en Supabase Storage
 * con las transformaciones especificadas aplicadas via el
 * endpoint /storage/v1/render/image/public/.
 *
 * Si no se especifican opciones de transformación, devuelve la URL
 * pública base sin transformar.
 *
 * @param bucket - Nombre del bucket de Supabase Storage
 * @param path   - Ruta al archivo dentro del bucket (ej: "imgs/uuid/img.jpg")
 * @param options - Opciones de transformación (width, height, quality, resize)
 */
export function getSupabaseImageUrl(
  bucket: string,
  path: string,
  options?: SupabaseImageTransformOptions
): string {
  if (!path) return '';
  if (!SUPABASE_URL) return '';

  const base = SUPABASE_URL.replace(/\/$/, '');

  // Sin opciones de transformación → URL pública directa
  if (!options || (!options.width && !options.height && !options.quality)) {
    return `${base}/storage/v1/object/public/${bucket}/${path}`;
  }

  // Con transformaciones → usar endpoint /render/image/public/
  const params = new URLSearchParams();
  if (options.width) params.set('width', String(options.width));
  if (options.height) params.set('height', String(options.height));
  params.set('quality', String(options.quality ?? 75));
  if (options.resize) params.set('resize', options.resize);

  return `${base}/storage/v1/render/image/public/${bucket}/${path}?${params.toString()}`;
}

// ─── Presets comunes para el proyecto ──────────────────────────────────────────

/** Thumbnail pequeño para tablas/listas (200×200) */
export const PRESET_THUMBNAIL: SupabaseImageTransformOptions = {
  width: 200,
  height: 200,
  quality: 75,
  resize: 'cover',
};

/** Card de producto en secciones públicas (400×300) */
export const PRESET_PRODUCT_CARD: SupabaseImageTransformOptions = {
  width: 400,
  height: 300,
  quality: 75,
  resize: 'cover',
};

/** Logo de tienda / marketplace (128×128) */
export const PRESET_LOGO: SupabaseImageTransformOptions = {
  width: 128,
  height: 128,
  quality: 80,
  resize: 'cover',
};

/** Cover de marketplace en listado (800×400) */
export const PRESET_COVER: SupabaseImageTransformOptions = {
  width: 800,
  height: 400,
  quality: 75,
  resize: 'cover',
};

/** Cover en modal de detalle (1200×600) */
export const PRESET_COVER_DETAIL: SupabaseImageTransformOptions = {
  width: 1200,
  height: 600,
  quality: 80,
  resize: 'cover',
};
