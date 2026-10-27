import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { CATALOG_IMAGE_FORBIDDEN, canEditCatalogImage, type CatalogImageActor } from './access';
import { loadCatalogImageProduct, resolveImageActor, type CatalogImageProduct } from './server';

type Fail = { error: NextResponse };

/** Sesión y actor (admin del catálogo o tienda) de una ruta de fotos del catálogo. */
export async function catalogImageAuth(
  storeId: string | null
): Promise<{ supabase: SupabaseClient<any>; service: SupabaseClient<any>; actor: CatalogImageActor } | Fail> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };

  const actor = await resolveImageActor(supabase, user.id, storeId);
  if (!actor) {
    return {
      error: NextResponse.json({ error: 'No tienes permisos para cambiar fotos del catálogo.' }, { status: 403 }),
    };
  }
  return { supabase, service: createSupabaseServiceClient(), actor };
}

/** El producto, si existe y el actor puede cambiarle la foto. */
export async function authorizeImageProduct(
  service: SupabaseClient<any>,
  actor: CatalogImageActor,
  productId: unknown
): Promise<{ product: CatalogImageProduct } | Fail> {
  const product = typeof productId === 'string' && productId ? await loadCatalogImageProduct(service, productId) : null;
  if (!product) return { error: NextResponse.json({ error: 'El producto no existe.' }, { status: 404 }) };
  if (!canEditCatalogImage(product, actor)) {
    return { error: NextResponse.json({ error: CATALOG_IMAGE_FORBIDDEN }, { status: 403 }) };
  }
  return { product };
}

export function serverError(where: string, error: unknown) {
  console.error(`${where}:`, error);
  return NextResponse.json({ error: 'No se pudo completar. Intenta de nuevo.' }, { status: 500 });
}

/** El `storeId` opcional de una petición; vacío es «como admin». */
export function storeIdFrom(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
