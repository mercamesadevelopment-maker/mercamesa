import { NextResponse } from 'next/server';
import { withPqrsActor } from '@/lib/pqrs/route-helpers';
import { loadFormContext } from '@/lib/pqrs/form-context';

/** Lo que el formulario necesita: pedidos, productos del elegido y motivos. */
export function GET(request: Request) {
  return withPqrsActor(request, async ({ service, actor }) => {
    const { searchParams } = new URL(request.url);

    const data = await loadFormContext(service, actor, {
      as: searchParams.get('as') === 'seller' ? 'seller' : 'buyer',
      storeOrderId: searchParams.get('store_order_id'),
      orderId: searchParams.get('order_id'),
      storeId: searchParams.get('store_id'),
    });

    return NextResponse.json({ data }, { status: 200 });
  });
}
