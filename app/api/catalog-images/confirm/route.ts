import { NextResponse } from 'next/server';
import {
  authorizeImageProduct,
  catalogImageAuth,
  serverError,
  storeIdFrom,
} from '@/lib/catalog-images/route-helpers';
import { isCatalogImagePathFor } from '@/lib/catalog-images/files';
import { generateCatalogImageVariants, removePreviousCatalogImage } from '@/lib/catalog-images/server';
import { getSupabaseImageUrl, PRESET_PRODUCT_CARD } from '@/lib/supabase/supabase-image';

/**
 * Pone como foto del producto la que el navegador acaba de subir con la URL
 * firmada: genera los derivados, la guarda y borra la anterior.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const auth = await catalogImageAuth(storeIdFrom(body.storeId));
    if ('error' in auth) return auth.error;

    const found = await authorizeImageProduct(auth.service, auth.actor, body.productId);
    if ('error' in found) return found.error;
    const { product } = found;

    // La ruta tiene que ser de una foto de ESTE producto: si no, bastaría con
    // mandar la de otro para quedarse con ella.
    if (!isCatalogImagePathFor(product.id, body.path)) {
      return NextResponse.json({ error: 'La foto no corresponde a este producto.' }, { status: 403 });
    }
    const path = body.path;

    await generateCatalogImageVariants(auth.service, path);

    const { error } = await auth.service.from('catalog_products').update({ image_url: path }).eq('id', product.id);
    if (error) throw error;

    await removePreviousCatalogImage(auth.service, product.imageUrl, path);

    return NextResponse.json({
      data: { id: product.id, imageUrl: path, imageSignedUrl: getSupabaseImageUrl('products', path, PRESET_PRODUCT_CARD) },
    });
  } catch (error) {
    return serverError('catalog-images/confirm POST', error);
  }
}
