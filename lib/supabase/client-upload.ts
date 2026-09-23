import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export async function uploadImageDirect(bucket: string, path: string, file: File): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || undefined,
    upsert: true,
  });
  if (error) throw error;
}

/**
 * El mismo `upload`, con el nombre que corresponde.
 *
 * `uploadImageDirect` nunca tuvo nada de imágenes —sube cualquier archivo— y los
 * PDF de los documentos legales pasan por acá. Se expone este alias para no
 * seguir propagando el nombre equivocado; el otro se conserva porque lo usan el
 * logo de tienda, la portada y el avatar.
 */
export const uploadFileDirect = uploadImageDirect;
