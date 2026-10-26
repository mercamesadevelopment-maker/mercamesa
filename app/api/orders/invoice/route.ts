import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { isPlatformAdmin } from '@/lib/auth/can-manage-store';
import { INVOICE_LINK_COLUMNS, invoiceLinkFor, type SiigoInvoiceRow } from '@/lib/siigo/invoice-link';

/**
 * La factura de Siigo de un pedido (`?order_id=`) o de la parte de una tienda
 * (`?store_order_id=`, como la tiene el panel de pedidos).
 *
 * La ven el admin y el superadmin, aunque sea un borrador, y el comprador del
 * pedido, solo timbrada. `siigo_invoices` no se lee desde una sesión: pasa por
 * aquí con el cliente de servicio.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const params = new URL(request.url).searchParams;
    const storeOrderId = params.get('store_order_id');
    let orderId = params.get('order_id');
    if (!orderId && !storeOrderId) {
      return NextResponse.json({ error: 'Falta el pedido.' }, { status: 400 });
    }

    const service = createSupabaseServiceClient();
    if (!orderId) {
      const { data: part } = await service.from('store_orders').select('order_id').eq('id', storeOrderId!).maybeSingle();
      orderId = part?.order_id ?? null;
    }
    const { data: order } = orderId
      ? await service.from('orders').select('id, buyer_id').eq('id', orderId).maybeSingle()
      : { data: null };
    if (!order) return NextResponse.json({ error: 'El pedido no existe.' }, { status: 404 });

    const viewer = (await isPlatformAdmin(supabase, user.id))
      ? 'platform'
      : order.buyer_id === user.id
        ? 'buyer'
        : null;
    if (!viewer) return NextResponse.json({ error: 'No puedes ver esta factura.' }, { status: 403 });

    const { data: invoice, error } = await service
      .from('siigo_invoices')
      .select(INVOICE_LINK_COLUMNS)
      .eq('order_id', order.id)
      .maybeSingle();
    if (error) throw new Error(error.message);

    return NextResponse.json({ data: invoiceLinkFor(invoice as SiigoInvoiceRow | null, viewer) }, { status: 200 });
  } catch (error) {
    console.error('orders/invoice GET:', error);
    return NextResponse.json({ error: 'No se pudo consultar la factura.' }, { status: 500 });
  }
}
