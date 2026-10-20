import { NextResponse } from 'next/server';
import { withStaffActor } from '@/lib/marketplace-staff/route-helpers';
import { receivePart } from '@/lib/logistics/orders';

/**
 * Logística recibió en la bahía la parte de una tienda. Con la última, se pide
 * el mensajero; si eso falla, la respuesta trae `deliveryError`.
 */
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withStaffActor(request, ['logistics'], async ({ service, actor }) => {
    const { id } = await params;
    const { order, deliveryError } = await receivePart(service, actor, id);
    return NextResponse.json({ data: order, deliveryError }, { status: 200 });
  }, { module: 'orders', action: 'receive' });
}
