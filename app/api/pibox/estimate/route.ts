import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { createClient } from '@/lib/supabase/server';
import {
  estimateBooking,
  loadBookingContext,
  buildBookingPayload,
  PiboxDataError,
  isPiboxEnabled,
  fromSubUnits,
} from '@/lib/pibox';
import { canManageStoreOrder } from '@/lib/pibox/authz';

/**
 * Cotiza el costo de domicilio de un pedido de tienda.
 * Solo estima: no crea el servicio ni despacha conductor.
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

    // Con el cliente de servicio: el contexto trae el nombre, el teléfono y la
    // dirección del comprador, que la tienda no lee directo en la base. El permiso
    // sobre la parte ya se comprobó arriba.
    const context = await loadBookingContext(createSupabaseServiceClient() as any, storeOrderId);
    // Para cotizar no se exige teléfono: nadie va a llamar a nadie todavía.
    const payload = buildBookingPayload(context, { requireCustomerPhone: false });

    const eta = await estimateBooking(payload);

    return NextResponse.json(
      {
        data: {
          fare: fromSubUnits(eta.fare?.subunits),
          currency: eta.fare?.iso || 'COP',
          estimate_arrival_ms: eta.estimate_arrival,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    // Dato del negocio incompleto (400) vs falla del proveedor (502)
    if (error instanceof PiboxDataError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : 'Error cotizando el domicilio';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
