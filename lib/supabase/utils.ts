import { getPublicSupabaseUrl } from '@/lib/env';

/**
 * Genera la URL pública para un recurso almacenado en un bucket de Supabase.
 * Si el recurso ya cuenta con una URL absoluta (HTTP/HTTPS), se retorna tal cual.
 * 
 * @param bucket Nombre del bucket de almacenamiento (ej: 'plazas', 'stores').
 * @param path Ruta relativa del archivo dentro del bucket.
 */
export function getStoragePublicUrl(bucket: string, path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  
  const baseUrl = getPublicSupabaseUrl();
  const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  return `${cleanBaseUrl}/storage/v1/object/public/${bucket}/${cleanPath}`;
}
