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
 * Borra un archivo del bucket desde el navegador.
 *
 * Existe para deshacer una subida cuando lo que viene después falla: el archivo
 * se sube ANTES de guardar la fila, así que un rechazo de la API dejaba el
 * objeto huérfano para siempre.
 *
 * No lanza. Si el borrado falla, queda un archivo suelto —molesto, no grave— y
 * hacer fallar el manejo de un error con otro error solo taparia el primero.
 */
export async function removeImageDirect(bucket: string, path: string): Promise<void> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) console.error('No se pudo borrar el archivo huérfano:', path, error.message);
  } catch (e) {
    console.error('No se pudo borrar el archivo huérfano:', path, e);
  }
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
