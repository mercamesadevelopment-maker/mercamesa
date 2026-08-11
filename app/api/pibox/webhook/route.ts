import { NextResponse } from 'next/server';
import {
  PIBOX_WEBHOOK_EVENT,
  piboxBookingStatusToOrderStatus,
  piboxPackageStatusToOrderStatus,
  piboxBookingStatusNeedsAttention,
  buildBookingStatusNote,
  buildPackageStatusNote,
  PIBOX_BOOKING_STATUS_LABEL,
} from '@/lib/pibox';
import {
  applyOrderStatusFromPibox,
  findStoreOrderIdByBooking,
  findStoreOrderIdByPackage,
} from '@/lib/pibox/services/sync.service';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { createNotification } from '@/lib/notifications/create-notification';
import type {
  PiboxBookingWebhookPayload,
  PiboxPackageWebhookPayload,
} from '@/lib/pibox';

/**
 * Receptor de eventos de Pibox.
 *
 * Autenticación: Pibox reenvía los headers que se declararon al registrar el
 * hook, así que se valida un secreto propio. Es el único mecanismo disponible
 * (no hay firma HMAC), pero es mejor que el precedente de zonapagos-callback,
 * que hoy no verifica nada.
 *
 * Ojo: la doc solo garantiza explícitamente el envío at-most-once (sin
 * reintentos) para el evento 2 (pre-paquetes), pero no promete reintentos para
 * los eventos 0 y 1 que sí consumimos. Se asume el peor caso y por eso existe
 * además el cron de reconciliación en /api/pibox/sync.
 */
export async function POST(request: Request) {
  try {
    const expectedSecret = process.env.PIBOX_WEBHOOK_SECRET;
    if (!expectedSecret) {
      console.error('PIBOX_WEBHOOK_SECRET no está configurado; se rechaza el evento.');
      return NextResponse.json({ error: 'Webhook no configurado' }, { status: 503 });
    }

    if (request.headers.get('x-pibox-secret') !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await request.json();
    const eventCd = payload?.event_cd;

    if (eventCd === PIBOX_WEBHOOK_EVENT.BOOKING_UPDATED) {
      await handleBookingEvent(payload as PiboxBookingWebhookPayload);
    } else if (eventCd === PIBOX_WEBHOOK_EVENT.PACKAGE_UPDATED) {
      await handlePackageEvent(payload as PiboxPackageWebhookPayload);
    } else {
      // Eventos que no consumimos (ej. pre-paquetes): se aceptan sin procesar
      // para que Pibox no los reintente ni los marque como fallidos.
      return NextResponse.json({ ignored: true }, { status: 200 });
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error procesando el evento';
    console.error('Error en webhook de Pibox:', message);
    // Se responde 200 igual: Pibox no reintenta, y un 500 solo dejaría el
    // evento perdido sin ganar nada. El cron de sync lo reconcilia después.
    return NextResponse.json({ received: false, error: message }, { status: 200 });
  }
}

async function handleBookingEvent(payload: PiboxBookingWebhookPayload) {
  const storeOrderId = await findStoreOrderIdByBooking(payload.booking_id);
  if (!storeOrderId) {
    console.warn(`Evento de Pibox para un booking desconocido: ${payload.booking_id}`);
    return;
  }

  const db = createSupabaseServiceClient();

  await db
    .from('pibox_bookings')
    .update({
      status_cd: payload.status_cd,
      driver_name: payload.driver?.name ?? null,
      driver_phone: payload.driver?.phone ?? null,
      vehicle_plates: payload.vehicle?.plates ?? null,
      relaunched_to_booking_id: payload.relaunched_to_id ?? null,
    })
    .eq('booking_id', payload.booking_id);

  // Cuando el conductor cancela, Pibox crea otro booking: el vigente pasa a ser
  // el nuevo, así que se marca el actual como inactivo y se enlaza el sucesor.
  if (payload.relaunched_to_id) {
    await db
      .from('pibox_bookings')
      .update({ is_active: false })
      .eq('booking_id', payload.booking_id);

    await db.from('pibox_bookings').upsert(
      {
        store_order_id: storeOrderId,
        booking_id: payload.relaunched_to_id,
        package_id: null,
        status_cd: null,
        package_status_cd: null,
        tracking_link: null,
        pickup_validation_code: null,
        validation_code: null,
        estimated_cost: null,
        final_cost: null,
        driver_name: null,
        driver_phone: null,
        vehicle_plates: null,
        canceled_pickup_reason_cd: null,
        not_received_reason_cd: null,
        relaunched_to_booking_id: null,
        raw: null,
      },
      { onConflict: 'booking_id' }
    );
  }

  await applyOrderStatusFromPibox(
    storeOrderId,
    piboxBookingStatusToOrderStatus(payload.status_cd),
    buildBookingStatusNote(payload.status_cd, {
      driverName: payload.driver?.name,
      vehiclePlates: payload.vehicle?.plates,
    })
  );

  if (piboxBookingStatusNeedsAttention(payload.status_cd)) {
    await notifyStoreMembers(
      storeOrderId,
      'Problema con el domicilio',
      `${PIBOX_BOOKING_STATUS_LABEL[payload.status_cd] || 'Estado inesperado'}. Revisa el pedido.`
    );
  }
}

async function handlePackageEvent(payload: PiboxPackageWebhookPayload) {
  const storeOrderId = await findStoreOrderIdByPackage(payload.package_id);
  if (!storeOrderId) {
    console.warn(`Evento de Pibox para un paquete desconocido: ${payload.package_id}`);
    return;
  }

  const db = createSupabaseServiceClient();
  await db
    .from('pibox_bookings')
    .update({ package_status_cd: payload.status_cd })
    .eq('package_id', payload.package_id);

  await applyOrderStatusFromPibox(
    storeOrderId,
    piboxPackageStatusToOrderStatus(payload.status_cd),
    buildPackageStatusNote(payload.status_cd)
  );
}

/** Avisa a los miembros de la tienda cuando el domicilio necesita intervención. */
async function notifyStoreMembers(storeOrderId: string, title: string, message: string) {
  const supabase = createSupabaseServiceClient();

  const { data: storeOrder } = await supabase
    .from('store_orders')
    .select('store_id')
    .eq('id', storeOrderId)
    .single();

  if (!storeOrder) return;

  const { data: members } = await supabase
    .from('store_members')
    .select('user_id')
    .eq('store_id', storeOrder.store_id);

  const recipientUserIds = (members || []).map((m) => m.user_id);
  if (recipientUserIds.length === 0) return;

  await createNotification({
    type: 'delivery_update',
    title,
    message,
    entityType: 'store_order',
    entityId: storeOrderId,
    recipientUserIds,
  });
}
