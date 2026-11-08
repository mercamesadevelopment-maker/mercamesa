import { NextResponse } from 'next/server';
import { withStaffActor } from '@/lib/marketplace-staff/route-helpers';
import { StaffError } from '@/lib/marketplace-staff/actor';
import { photoUploadError } from '@/lib/storage/photo-rules';
import { RECEPTION_MAX_PHOTOS } from '@/lib/logistics/reception-rules';
import { createReceptionUploadTicket } from '@/lib/logistics/bay-reception';

/**
 * Un permiso de subida por cada foto de la recepción. El navegador sube directo
 * al bucket y después manda las rutas al recibir o al completar la evidencia.
 */
export function POST(request: Request) {
  return withStaffActor(request, ['logistics'], async ({ service, actor }) => {
    const body = await request.json().catch(() => ({}));
    const files: { type?: unknown; size?: unknown }[] = Array.isArray(body.files) ? body.files : [];

    const error = photoUploadError(files, RECEPTION_MAX_PHOTOS);
    if (error) throw new StaffError(error, 400);

    const data = await Promise.all(
      files.map((file) => createReceptionUploadTicket(service, actor.userId, String(file.type)))
    );
    return NextResponse.json({ data }, { status: 201 });
  }, { module: 'orders', action: 'receive' });
}
