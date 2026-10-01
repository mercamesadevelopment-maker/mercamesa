import { NextResponse } from 'next/server';
import { withPqrsActor } from '@/lib/pqrs/route-helpers';
import { getPqrsDetail } from '@/lib/pqrs/queries';

export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPqrsActor(request, async ({ service, actor }) => {
    const { id } = await params;

    const data = await getPqrsDetail(service, actor, id);
    // Un caso ajeno se responde igual que uno que no existe.
    if (!data) return NextResponse.json({ error: 'No encontramos esa PQRS.' }, { status: 404 });

    return NextResponse.json({ data }, { status: 200 });
  });
}
