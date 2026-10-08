import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  createBooking,
  loadBookingContext,
  buildBookingPayload,
  PiboxDataError,
  isPiboxEnabled,
} from '@/lib/pibox';
import { toDeliveryView, type DeliveryViewer } from '@/lib/pibox/delivery-view';
import { canManageStoreOrder } from '@/lib/pibox/authz';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { persistBookingSnapshot } from '@/lib/pibox/services/sync.service';

/**
 * Solicita el domicilio a Pibox para un pedido de tienda.
 * Se dispara cuando el pedido pasa a "at_collection" (Listo Recogida), y desde
 * «Solicitar otro domiciliario» cuando el anterior se cerró sin entregar.
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
    // ese en vez de despachar un segundo mensajero. Una reserva sin conductor o
    // cancelada ya no es vigente (`is_active = false`), así que no bloquea.
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

    // Solo se despacha lo que está pagado: ya no hay contraentrega. El
    // cotizador de la canasta usa el mismo armador del payload con el pago
    // «pendiente», por eso la regla vive acá y no allá.
    if (context.paymentStatus !== 'approved') {
      throw new PiboxDataError(
        'El pago de este pedido aún no está aprobado: no se puede pedir el domiciliario.'
      );
    }

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

/**
 * El domicilio de un pedido de tienda, para las pantallas de seguimiento.
 *
 * - `?store_order_id=`: tienda y admin.
 * - `?order_id=&store_id=`: el comprador, cuya vista de pedidos no trae el id
 *   de la parte de tienda.
 *
 * Antes no revisaba permisos y devolvía la fila entera, `raw` incluido (datos
 * del comprador y del conductor). Ahora lo ven el comprador, la tienda y el
 * admin, y cada uno solo lo suyo (`toDeliveryView`).
 *
 * Responde la reserva vigente o, si no hay, la más reciente; el admin recibe
 * además el historial de reservas del pedido.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const db = createSupabaseServiceClient();

    let query = db.from('store_orders').select('id, store_id, orders!inner ( buyer_id )');
    const storeOrderIdParam = searchParams.get('store_order_id');
    const orderId = searchParams.get('order_id');
    const storeId = searchParams.get('store_id');

    if (storeOrderIdParam) {
      query = query.eq('id', storeOrderIdParam);
    } else if (orderId && storeId) {
      query = query.eq('order_id', orderId).eq('store_id', storeId);
    } else {
      return NextResponse.json(
        { error: 'Se requiere store_order_id, o order_id y store_id.' },
        { status: 400 }
      );
    }

    const { data: storeOrder } = await query.maybeSingle();
    if (!storeOrder) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    const viewer = await resolveViewer(storeOrder as any, user.id);
    if (!viewer) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data: rows, error } = await db
      .from('pibox_bookings')
      .select('*')
      .eq('store_order_id', storeOrder.id)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const current = (rows ?? []).find((r) => r.is_active) ?? rows?.[0] ?? null;

    return NextResponse.json(
      {
        data: {
          storeOrderId: storeOrder.id,
          viewer,
          delivery: current ? toDeliveryView(current, viewer) : null,
          ...(viewer === 'admin'
            ? { history: (rows ?? []).map((r) => toDeliveryView(r, 'admin')) }
            : {}),
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error consultando domicilios';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Quién mira, con el mismo criterio que la política de lectura de la tabla:
 * admin, miembro de la tienda o el comprador del pedido. Si ninguno, null.
 */
async function resolveViewer(
  storeOrder: { store_id: string; orders: { buyer_id: string } | null },
  userId: string
): Promise<DeliveryViewer | null> {
  const db = createSupabaseServiceClient();

  const { data: profile } = await db
    .from('profiles')
    .select('roles ( name )')
    .eq('id', userId)
    .maybeSingle();

  const role = (profile as any)?.roles?.name;
  if (role === 'admin' || role === 'superadmin') return 'admin';

  const { data: membership } = await db
    .from('store_members')
    .select('id')
    .eq('store_id', storeOrder.store_id)
    .eq('user_id', userId)
    .maybeSingle();

  if (membership) return 'store';
  if (storeOrder.orders?.buyer_id === userId) return 'buyer';
  return null;
}
