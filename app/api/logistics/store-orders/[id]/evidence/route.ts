import { NextResponse } from 'next/server';
import { withStaffActor } from '@/lib/marketplace-staff/route-helpers';
import { updateEvidence } from '@/lib/logistics/orders';

/** Agrega fotos o cambia la observación de una parte ya recibida, mientras siga en la plaza. */
export function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withStaffActor(request, ['logistics'], async ({ service, actor }) => {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const data = await updateEvidence(service, actor, id, body);
    return NextResponse.json({ data }, { status: 200 });
  }, { module: 'orders', action: 'receive' });
}
