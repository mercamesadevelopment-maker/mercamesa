import { NextResponse } from 'next/server';
import {
  getBooking,
  isPiboxEnabled,
  piboxBookingStatusToOrderStatus,
  piboxPackageStatusToOrderStatus,
  buildBookingStatusNote,
  buildPackageStatusNote,
  extractFirstPackage,
} from '@/lib/pibox';
import {
  persistBookingSnapshot,
  applyOrderStatusFromPibox,
} from '@/lib/pibox/services/sync.service';
import { createSupabaseServiceClient } from '@/lib/supabase/service';

/** Estados en los que la orden ya no espera nada del mensajero. */
const TERMINAL_STATUSES = ['delivered', 'cancelled', 'returned'];

/**
 * Cron de reconciliación: vuelve a consultar en Pibox los domicilios activos.
 *
 * Existe porque Pibox no promete reintentos de webhook: la doc declara el envío
 * at-most-once para pre-paquetes (ver docs/webhooksPicap.MD) y no garantiza
 * reintentos para los eventos 0 y 1, así que un endpoint caído puede perder
 * eventos. Aplica exactamente el mismo mapeo de estados que el webhook, usando
 * las mismas funciones puras, para que no haya dos lógicas divergentes.
 *
 * Se protege con CRON_SECRET, igual que el cron de zonapagos-sonda.
 */
export async function POST(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization');

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isPiboxEnabled()) {
      return NextResponse.json({ skipped: 'PIBOX_ENABLED=false' }, { status: 200 });
    }

    const supabase = createSupabaseServiceClient();

    const { data: activeBookings, error } = await supabase
      .from('pibox_bookings')
      .select('booking_id, store_order_id')
      .eq('is_active', true);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let checked = 0;
    let updated = 0;

    for (const row of activeBookings || []) {
      // Se saltan los pedidos que ya llegaron a un estado final
      const { data: storeOrder } = await supabase
        .from('store_orders')
        .select('status')
        .eq('id', row.store_order_id)
        .single();

      if (!storeOrder || TERMINAL_STATUSES.includes(storeOrder.status)) continue;

      try {
        const booking = await getBooking(row.booking_id);
        await persistBookingSnapshot(row.store_order_id, booking);
        checked++;

        // El estado del paquete es más específico que el del pedido, así que
        // manda cuando existe.
        const pkg = extractFirstPackage(booking);

        const changed = pkg
          ? await applyOrderStatusFromPibox(
              row.store_order_id,
              piboxPackageStatusToOrderStatus(pkg.status_cd) ??
                piboxBookingStatusToOrderStatus(booking.status_cd),
              pkg
                ? buildPackageStatusNote(pkg.status_cd, {
                    notReceivedReasonCd: pkg.not_received_reason_cd,
                    canceledPickupReasonCd: pkg.canceled_pickup_reason_cd,
                  })
                : buildBookingStatusNote(booking.status_cd)
            )
          : await applyOrderStatusFromPibox(
              row.store_order_id,
              piboxBookingStatusToOrderStatus(booking.status_cd),
              buildBookingStatusNote(booking.status_cd, {
                driverName: booking.driver?.name,
                vehiclePlates: booking.served_vehicle?.plates,
              })
            );

        if (changed) updated++;
      } catch (err) {
        console.error(`Error reconciliando el booking ${row.booking_id}:`, err);
      }
    }

    return NextResponse.json({ checked, updated }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error en la reconciliación';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
