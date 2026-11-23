import { NextResponse } from 'next/server';
import { getAuthenticatedClient } from '@/lib/supabase/auth-helpers';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { revertStoreOrderWithCourier } from '@/lib/orders/revert-store-order';
import { Constants } from '@/types/database_generated';

const ORDER_STATUSES = Constants.public.Enums.order_status;

/**
 * Regresa una parte de pedido a un estado anterior, con observación. Si ya se
 * pidió el mensajero y el paquete deja de estar listo, lo cancela en Pibox antes
 * (`lib/orders/revert-store-order.ts`).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user, error } = await getAuthenticatedClient(request);
    if (error || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const target = String(body?.target ?? '');
    if (!(ORDER_STATUSES as readonly string[]).includes(target)) {
      return NextResponse.json({ error: 'Estado de destino no válido.' }, { status: 400 });
    }

    const r = await revertStoreOrderWithCourier(supabase as any, createSupabaseServiceClient() as any, {
      storeOrderId: id,
      target: target as (typeof ORDER_STATUSES)[number],
      notes: String(body?.notes ?? ''),
      userId: user.id,
    });
    if ('message' in r) return NextResponse.json({ error: r.message }, { status: r.status });
    return NextResponse.json({ data: { courier: r.courier } });
  } catch (error) {
    console.error('POST /api/store-orders/[id]/revert:', error);
    return NextResponse.json({ error: 'No se pudo regresar el pedido.' }, { status: 500 });
  }
}
