import { NextResponse } from 'next/server';
import {
  authorizeImageProduct,
  catalogImageAuth,
  serverError,
  storeIdFrom,
} from '@/lib/catalog-images/route-helpers';
import { CATALOG_IMAGE_BUCKET, catalogImagePath, isAcceptedImageExtension } from '@/lib/catalog-images/files';

/**
 * Una URL firmada para subir la foto de un producto del catálogo.
 *
 * La tienda no tiene permiso de escritura en el bucket, y abrírselo le dejaría
 * escribir cualquier ruta: la firma vale para una sola ruta, la de ese producto,
 * y solo se entrega si puede cambiarle la foto.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const auth = await catalogImageAuth(storeIdFrom(body.storeId));
    if ('error' in auth) return auth.error;

    const ext = String(body.extension ?? '').toLowerCase();
    if (!isAcceptedImageExtension(ext)) {
      return NextResponse.json({ error: 'Solo se aceptan fotos JPG, PNG o WEBP.' }, { status: 400 });
    }

    const found = await authorizeImageProduct(auth.service, auth.actor, body.productId);
    if ('error' in found) return found.error;

    const path = catalogImagePath(found.product.id, ext === 'jpeg' ? 'jpg' : ext);
    const { data, error } = await auth.service.storage.from(CATALOG_IMAGE_BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw error ?? new Error('Sin URL firmada');

    return NextResponse.json({ data: { path, token: data.token } });
  } catch (error) {
    return serverError('catalog-images/upload-url POST', error);
  }
}
