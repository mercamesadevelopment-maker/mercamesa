import { NextResponse } from 'next/server';
import { withRunnerActor } from '@/lib/runner/route-helpers';
import { markAtBay } from '@/lib/runner/orders';

/**
 * El pedido quedó completo en la bahía: se pide el mensajero.
 *
 * Si la solicitud falla el pedido queda en la bahía igual y la respuesta trae
 * `deliveryError`, para que el patinador sepa que tiene que reintentar.
 */
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withRunnerActor(request, async ({ service, actor }) => {
    const { id } = await params;
    const { order, deliveryError } = await markAtBay(service, actor, id);
    return NextResponse.json({ data: order, deliveryError }, { status: 200 });
  });
}
