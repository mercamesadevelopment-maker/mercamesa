import { NextResponse } from 'next/server';
import { withStaffActor } from '@/lib/marketplace-staff/route-helpers';
import { listRunnerOrders } from '@/lib/runner/orders';

/** Los pedidos de varias tiendas de las plazas del patinador. */
export function GET(request: Request) {
  return withStaffActor(request, ['runner'], async ({ service, actor }) => {
    const scope = new URL(request.url).searchParams.get('scope') === 'closed' ? 'closed' : 'open';
    const data = await listRunnerOrders(service, actor, scope);
    return NextResponse.json({ data }, { status: 200 });
  }, { module: 'runner-orders', action: 'read' });
}
