import type { SupabaseClient } from '@supabase/supabase-js';
import { canManageStore } from '@/lib/auth/can-manage-store';
import { getStoreGroupId, type CatalogAccess } from '@/lib/catalog/visibility';
import { removeImageAndVariants, uploadVariants } from '@/lib/images/generate';
import { PRODUCT_IMAGE_VARIANTS } from '@/lib/images/variants';
import type { CatalogImageActor } from './access';
import { CATALOG_IMAGE_BUCKET } from './files';

/**
 * Quién pide subir fotos.
 *
 * Con `storeId`, actúa como esa tienda (tiene que ser miembro, o admin de
 * plataforma). Sin él, como admin del catálogo maestro. `null` si no puede
 * ninguna de las dos cosas.
 */
export async function resolveImageActor(
  supabase: SupabaseClient<any>,
  userId: string,
  storeId: string | null
): Promise<CatalogImageActor | null> {
  if (storeId) {
    if (!(await canManageStore(supabase, storeId, userId))) return null;
    return { kind: 'store', storeId, groupId: await getStoreGroupId(supabase, storeId) };
  }
  const { data: allowed } = await supabase.rpc('has_permission', {
    module_key: 'master-catalog',
    action_name: 'update',
  });
  return allowed ? { kind: 'admin' } : null;
}

export interface CatalogImageProduct extends CatalogAccess {
  id: string;
  imageUrl: string | null;
}

/** `catalog_products` no tiene RLS: se lee con el cliente de servicio, después de saber quién es. */
export async function loadCatalogImageProduct(
  service: SupabaseClient<any>,
  productId: string
): Promise<CatalogImageProduct | null> {
  const { data, error } = await service
    .from('catalog_products')
    .select('id, image_url, owner_group_id, review_status, proposed_by_store_id')
    .eq('id', productId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    id: data.id,
    imageUrl: data.image_url,
    ownerGroupId: data.owner_group_id,
    reviewStatus: data.review_status,
    proposedByStoreId: data.proposed_by_store_id,
  };
}

/**
 * Genera los derivados WebP de una foto ya subida al bucket.
 *
 * El original lo sube el navegador directo a Storage (las funciones no reciben
 * más de 4,5 MB); acá solo se descarga para pasarlo por `sharp`.
 */
export async function generateCatalogImageVariants(
  supabase: SupabaseClient<any>,
  path: string
): Promise<void> {
  const { data: file, error } = await supabase.storage.from(CATALOG_IMAGE_BUCKET).download(path);
  if (error) throw error;
  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadVariants(supabase, CATALOG_IMAGE_BUCKET, path, buffer, PRODUCT_IMAGE_VARIANTS);
}

/** Borra la foto anterior y sus derivados, si había una distinta. */
export async function removePreviousCatalogImage(
  supabase: SupabaseClient<any>,
  previous: string | null,
  current: string
): Promise<void> {
  if (previous && previous !== current) {
    await removeImageAndVariants(supabase, CATALOG_IMAGE_BUCKET, previous, PRODUCT_IMAGE_VARIANTS);
  }
}
