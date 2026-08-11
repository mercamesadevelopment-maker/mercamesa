import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getBooking,
  cancelBooking,
  isPiboxEnabled,
  piboxBookingStatusToOrderStatus,
  buildBookingStatusNote,
} from '@/lib/pibox';
import { canManageStoreOrder } from '@/lib/pibox/authz';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import {
  persistBookingSnapshot,
  applyOrderStatusFromPibox,
  findStoreOrderIdByBooking,
} from '@/lib/pibox/services/sync.service';

/** Detalle del domicilio, refrescado contra Pibox. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isPiboxEnabled()) {
      return NextResponse.json(
        { error: 'La integración con Pibox está desactivada (PIBOX_ENABLED).' },
        { status: 503 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const storeOrderId = await findStoreOrderIdByBooking(id);
    if (!storeOrderId) {
      return NextResponse.json({ error: 'Domicilio no encontrado' }, { status: 404 });
    }

    if (!(await canManageStoreOrder(supabase, storeOrderId, user.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const booking = await getBooking(id);
    await persistBookingSnapshot(storeOrderId, booking);

    const db = createSupabaseServiceClient();
    const { data } = await db
      .from('pibox_bookings')
      .select('*')
      .eq('booking_id', id)
      .maybeSingle();

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error consultando el domicilio';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/** Cancela el domicilio en Pibox. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isPiboxEnabled()) {
      return NextResponse.json(
        { error: 'La integración con Pibox está desactivada (PIBOX_ENABLED).' },
        { status: 503 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const storeOrderId = await findStoreOrderIdByBooking(id);
    if (!storeOrderId) {
      return NextResponse.json({ error: 'Domicilio no encontrado' }, { status: 404 });
    }

    if (!(await canManageStoreOrder(supabase, storeOrderId, user.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const booking = await cancelBooking(id);
    await persistBookingSnapshot(storeOrderId, booking);

    await applyOrderStatusFromPibox(
      storeOrderId,
      piboxBookingStatusToOrderStatus(booking.status_cd),
      buildBookingStatusNote(booking.status_cd)
    );

    return NextResponse.json({ data: booking }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error cancelando el domicilio';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
