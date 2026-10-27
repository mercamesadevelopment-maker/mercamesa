import type { CatalogAccess } from '@/lib/catalog/visibility';

/**
 * Quién sube la foto de un producto del catálogo.
 *
 * - `admin`: quien edita el catálogo maestro (`master-catalog/update`).
 * - `store`: una tienda. Las tiendas de un grupo (`store_groups`) manejan su
 *   propia galería: sus productos son exclusivos del grupo, y la foto también.
 */
export type CatalogImageActor =
  | { kind: 'admin' }
  | { kind: 'store'; storeId: string; groupId: string | null };

/**
 * ¿Puede este actor poner o cambiar la foto del producto?
 *
 * La tienda solo toca lo suyo: los productos de su grupo y los que ella propuso
 * y siguen en revisión. La foto de un producto público la comparten todas las
 * tiendas, así que la pone el admin; la de otro grupo es ajena.
 */
export function canEditCatalogImage(product: CatalogAccess, actor: CatalogImageActor): boolean {
  if (actor.kind === 'admin') return true;
  if (product.reviewStatus === 'pending') return product.proposedByStoreId === actor.storeId;
  return !!product.ownerGroupId && product.ownerGroupId === actor.groupId;
}

export const CATALOG_IMAGE_FORBIDDEN =
  'Solo puedes cambiar las fotos de los productos de tu grupo de tiendas o de los que propusiste.';
