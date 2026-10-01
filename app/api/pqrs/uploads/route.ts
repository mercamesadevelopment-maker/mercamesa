import { NextResponse } from 'next/server';
import { withPqrsActor } from '@/lib/pqrs/route-helpers';
import { PqrsInputError } from '@/lib/pqrs/errors';
import { MAX_PHOTOS } from '@/lib/pqrs/rules';
import { createUploadTicket, PQRS_PHOTO_MAX_BYTES, PQRS_PHOTO_TYPES } from '@/lib/pqrs/storage';

/**
 * Entrega un permiso de subida por cada foto.
 *
 * El navegador sube directo al bucket con ese permiso y después manda las rutas
 * al radicar o al escribir un mensaje.
 */
export function POST(request: Request) {
  return withPqrsActor(request, async ({ service, actor }) => {
    const body = await request.json().catch(() => ({}));
    const files: { type?: string; size?: number }[] = Array.isArray(body.files) ? body.files : [];

    if (files.length === 0) throw new PqrsInputError('No hay fotos que subir.');
    if (files.length > MAX_PHOTOS) throw new PqrsInputError(`Puedes adjuntar hasta ${MAX_PHOTOS} fotos.`);

    for (const file of files) {
      if (!PQRS_PHOTO_TYPES[String(file.type)]) {
        throw new PqrsInputError('Solo se aceptan fotos JPG, PNG o WebP.');
      }
      if (!(Number(file.size) > 0) || Number(file.size) > PQRS_PHOTO_MAX_BYTES) {
        throw new PqrsInputError('Cada foto puede pesar hasta 8 MB.');
      }
    }

    const data = await Promise.all(
      files.map((file) => createUploadTicket(service, actor.userId, String(file.type)))
    );

    return NextResponse.json({ data }, { status: 201 });
  });
}
