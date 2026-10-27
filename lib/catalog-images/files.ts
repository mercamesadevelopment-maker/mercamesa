/**
 * Las fotos del catálogo: dónde quedan en Storage y cuáles se aceptan.
 * Lo usan el servidor (para firmar y comprobar la ruta) y el navegador (para
 * rechazar un archivo antes de subirlo).
 */

export const CATALOG_IMAGE_BUCKET = 'products';

/** Una foto de producto más pesada es casi siempre una foto de cámara sin reducir. */
export const CATALOG_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

/** Lo que `sharp` convierte a WebP sin sorpresas. HEIC no: el iPhone lo exporta como JPG al compartir. */
export const CATALOG_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const;

export function imageExtension(fileName: string): string {
  const i = fileName.lastIndexOf('.');
  return i < 0 ? '' : fileName.slice(i + 1).toLowerCase();
}

export function isAcceptedImageExtension(ext: string): boolean {
  return (CATALOG_IMAGE_EXTENSIONS as readonly string[]).includes(ext);
}

/** La misma convención que la edición de un producto (`ProductModal`). */
export function catalogImagePath(productId: string, ext: string, now = Date.now()): string {
  return `imgs/${productId}/img-${now}.${ext}`;
}

/**
 * ¿La ruta es de una foto de ESE producto?
 *
 * Sin esto bastaría con mandar la ruta de la foto de otro producto, o de otro
 * archivo del bucket, para ponerla como propia.
 */
export function isCatalogImagePathFor(productId: string, path: unknown): path is string {
  if (typeof path !== 'string' || path.includes('..')) return false;
  const prefix = `imgs/${productId}/img-`;
  return path.startsWith(prefix) && isAcceptedImageExtension(imageExtension(path)) && !path.slice(prefix.length).includes('/');
}
