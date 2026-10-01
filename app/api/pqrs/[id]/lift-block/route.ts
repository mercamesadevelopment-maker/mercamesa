import { NextResponse } from 'next/server';
import { withPqrsActor } from '@/lib/pqrs/route-helpers';
import { liftPqrsBlock } from '@/lib/pqrs/actions';
import { getPqrsDetail } from '@/lib/pqrs/queries';

/** El administrador levanta el bloqueo que salió de esta solicitud. Devuelve el caso como quedó. */
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPqrsActor(request, async ({ service, actor }) => {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    await liftPqrsBlock(service, actor, id, body);

    const data = await getPqrsDetail(service, actor, id);
    return NextResponse.json({ data }, { status: 200 });
  });
}
