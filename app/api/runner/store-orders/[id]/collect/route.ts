import { NextResponse } from 'next/server';
import { withRunnerActor } from '@/lib/runner/route-helpers';
import { collectPart } from '@/lib/runner/orders';

/** El patinador recogió la parte de una tienda. Devuelve el pedido como quedó. */
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withRunnerActor(request, async ({ service, actor }) => {
    const { id } = await params;
    const data = await collectPart(service, actor, id);
    return NextResponse.json({ data }, { status: 200 });
  });
}
