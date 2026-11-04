import type { SupabaseClient } from '@supabase/supabase-js';
import { removeImageAndVariants } from '@/lib/images/generate';
import { storeError, type StoreResult } from './store-result';

/**
 * Borra una tienda (`DELETE /api/stores/[id]`), con su logo y su portada.
 * Arrastra productos, pedidos y miembros: quien llama ya comprobó que es de la
 * plataforma.
 */
export async function deleteStore(supabase: SupabaseClient<any>, storeId: string): Promise<StoreResult> {
  const { data: storeToDelete } = await supabase.from('stores').select('cover_image_url, logo_url').eq('id', storeId).single();

  if (storeToDelete?.cover_image_url) {
    await removeImageAndVariants(supabase, 'stores', storeToDelete.cover_image_url, ['cover']);
  }
  if (storeToDelete?.logo_url) {
    await removeImageAndVariants(supabase, 'stores', storeToDelete.logo_url, ['logo']);
  }

  const { error } = await supabase.from('stores').delete().eq('id', storeId);
  if (error) return storeError(400, error.message);
  return { status: 200, body: { message: 'Deleted successfully' } };
}
