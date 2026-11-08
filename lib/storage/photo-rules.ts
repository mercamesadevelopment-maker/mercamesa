/**
 * Las fotos que la gente adjunta (PQRS, recepción en la bahía): qué tipos y qué
 * peso se aceptan. Sin dependencias del servidor: también lo usa el navegador
 * para filtrar antes de subir.
 */

export const PHOTO_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const PHOTO_MAX_BYTES = 8 * 1024 * 1024;

/**
 * Por qué no se puede pedir la subida de estas fotos, o `null` si se puede.
 * Lo que llega es lo que el navegador declara: el bucket vuelve a exigir el
 * tipo y el tope.
 */
export function photoUploadError(files: { type?: unknown; size?: unknown }[], max: number): string | null {
  if (files.length === 0) return 'No hay fotos que subir.';
  if (files.length > max) return `Puedes adjuntar hasta ${max} fotos.`;
  for (const file of files) {
    if (!PHOTO_TYPES[String(file.type)]) return 'Solo se aceptan fotos JPG, PNG o WebP.';
    const size = Number(file.size);
    if (!(size > 0) || size > PHOTO_MAX_BYTES) return 'Cada foto puede pesar hasta 8 MB.';
  }
  return null;
}
