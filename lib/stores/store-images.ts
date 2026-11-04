import type { SupabaseClient } from '@supabase/supabase-js';
import { removeImageAndVariants, uploadVariants } from '@/lib/images/generate';

/**
 * Genera las variantes WebP del logo o la portada de una tienda.
 *
 * El navegador ya subió el original directo a Storage (evita el límite de
 * payload de las funciones serverless); acá solo se descarga para generar los
 * derivados con sharp. Si se pasa la imagen anterior, se borra con sus
 * variantes.
 */
export async function processStoreImage(
  supabase: SupabaseClient<any>,
  path: string,
  variant: 'cover' | 'logo',
  previous?: string | null
): Promise<void> {
  const { data: fileData, error: downloadError } = await supabase.storage.from('stores').download(path);
  if (downloadError) throw downloadError;
  const buffer = Buffer.from(await fileData.arrayBuffer());

  await uploadVariants(supabase, 'stores', path, buffer, [variant]);

  if (previous) await removeImageAndVariants(supabase, 'stores', previous, [variant]);
}
