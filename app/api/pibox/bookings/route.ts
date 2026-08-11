import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  createBooking,
  loadBookingContext,
  buildBookingPayload,
  PiboxDataError,
  isPiboxEnabled,
} from '@/lib/pibox';
import { canManageStoreOrder } from '@/lib/pibox/authz';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { persistBookingSnapshot } from '@/lib/pibox/services/sync.service';

/**
 * Solicita el domicilio a Pibox para un pedido de tienda.
 * Se dispara cuando el pedido pasa a "at_collection" (Listo Recogida).
 */
export async function POST(request: Request) {
  try {
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

    const { store_order_id: storeOrderId } = await request.json();
    if (!storeOrderId) {
      return NextResponse.json({ error: 'store_order_id es requerido' }, { status: 400 });
    }

    if (!(await canManageStoreOrder(supabase, storeOrderId, user.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Idempotencia: si ya hay un domicilio vigente para este pedido, se devuelve
    // ese en vez de despachar un segundo mensajero.
    const db = createSupabaseServiceClient();
    const { data: existing } = await db
      .from('pibox_bookings')
      .select('*')
      .eq('store_order_id', storeOrderId)
      .eq('is_active', true)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ data: existing, already_exists: true }, { status: 200 });
    }

    const context = await loadBookingContext(supabase, storeOrderId);
    const payload = buildBookingPayload(context);

    const booking = await createBooking(payload);
    await persistBookingSnapshot(storeOrderId, booking);

    const { data: saved } = await db
      .from('pibox_bookings')
      .select('*')
      .eq('booking_id', booking._id)
      .maybeSingle();

    return NextResponse.json({ data: saved, already_exists: false }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof PiboxDataError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : 'Error solicitando el domicilio';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/** Lista los domicilios de un pedido de tienda. */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const storeOrderId = searchParams.get('store_order_id');
    if (!storeOrderId) {
      return NextResponse.json({ error: 'store_order_id es requerido' }, { status: 400 });
    }

    const db = createSupabaseServiceClient();
    const { data, error } = await db
      .from('pibox_bookings')
      .select('*')
      .eq('store_order_id', storeOrderId)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error consultando domicilios';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
