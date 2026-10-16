import { NextResponse } from 'next/server';
import { withStaffActor } from '@/lib/marketplace-staff/route-helpers';
import { dispatchOrder } from '@/lib/logistics/orders';

/** Logística le entregó el pedido al domiciliario: pasa a «En camino». */
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withStaffActor(request, ['logistics'], async ({ service, actor }) => {
    const { id } = await params;
    const data = await dispatchOrder(service, actor, id);
    return NextResponse.json({ data }, { status: 200 });
  }, { module: 'orders', action: 'dispatch' });
}
