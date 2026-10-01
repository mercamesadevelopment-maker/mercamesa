import { NextResponse } from 'next/server';
import { withRunnerActor } from '@/lib/runner/route-helpers';
import { listRunnerOrders } from '@/lib/runner/orders';

/** Los pedidos de varias tiendas de las plazas del patinador. */
export function GET(request: Request) {
  return withRunnerActor(request, async ({ service, actor }) => {
    const scope = new URL(request.url).searchParams.get('scope') === 'closed' ? 'closed' : 'open';
    const data = await listRunnerOrders(service, actor, scope);
    return NextResponse.json({ data }, { status: 200 });
  });
}
