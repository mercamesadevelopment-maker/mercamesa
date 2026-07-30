/**
 * lib/images/variants.ts
 *
 * Definición de los derivados WebP que reemplazan a Supabase Image
 * Transformations. Módulo puro (sin `sharp`), usable tanto en cliente
 * como en servidor, ya que solo calcula nombres de archivo y tamaños.
 *
 * Convención de ruta: el derivado vive junto al original, mismo nombre
 * de archivo sin extensión + `__{variant}.webp`.
 *   imgs/{id}/img-1784064880938.jpg          (original)
 *   imgs/{id}/img-1784064880938__card.webp   (derivado)
 */

export type ImageVariant = 'thumb' | 'card' | 'logo' | 'cover';

export interface VariantSpec {
  width: number;
  height: number;
  quality: number;
}

export const IMAGE_VARIANTS: Record<ImageVariant, VariantSpec> = {
  thumb: { width: 200, height: 200, quality: 72 },
  card: { width: 480, height: 360, quality: 72 },
  logo: { width: 256, height: 256, quality: 80 },
  cover: { width: 1200, height: 600, quality: 75 },
};

/** Variantes que necesita cada tipo de entidad al subir su imagen. */
export const PRODUCT_IMAGE_VARIANTS: ImageVariant[] = ['thumb', 'card'];

/**
 * Calcula la ruta del derivado a partir de la ruta del original.
 * Determinista: no requiere guardar nada nuevo en la base de datos.
 */
export function derivativePath(originalPath: string, variant: ImageVariant): string {
  const dotIndex = originalPath.lastIndexOf('.');
  const base = dotIndex === -1 ? originalPath : originalPath.slice(0, dotIndex);
  return `${base}__${variant}.webp`;
}
