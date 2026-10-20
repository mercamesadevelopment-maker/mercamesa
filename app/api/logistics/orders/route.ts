import { NextResponse } from 'next/server';
import { withStaffActor } from '@/lib/marketplace-staff/route-helpers';
import { listLogisticsOrders } from '@/lib/logistics/orders';

/** Los pedidos de las plazas de logística: los que siguen en la plaza o los últimos que salieron. */
export function GET(request: Request) {
  return withStaffActor(request, ['logistics'], async ({ service, actor }) => {
    const scope = new URL(request.url).searchParams.get('scope') === 'closed' ? 'closed' : 'open';
    const data = await listLogisticsOrders(service, actor, scope);
    return NextResponse.json({ data }, { status: 200 });
  }, { module: 'orders', action: 'read' });
}
