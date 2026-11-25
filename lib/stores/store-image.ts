/**
 * El logo y la portada de una tienda: lo que se revisa antes de subirlos. Lo usan
 * el tendero (perfil de la tienda) y el admin (`StoreModal`).
 */
export const STORE_IMAGE_MAX_MB = 50;
const MAX_BYTES = STORE_IMAGE_MAX_MB * 1024 * 1024;

/** El motivo por el que no se puede subir, o `null` si sirve. */
export function storeImageError(file: { type: string; size: number }): string | null {
  if (!file.type.startsWith('image/')) return 'El archivo debe ser una imagen.';
  if (file.size > MAX_BYTES) return `La imagen no puede pesar más de ${STORE_IMAGE_MAX_MB} MB.`;
  return null;
}
