import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { INVOICE_LINK_COLUMNS, invoiceLinkFor, type SiigoInvoiceRow } from '@/lib/siigo/invoice-link';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const storeId = searchParams.get('store_id');
    const status = searchParams.get('status');

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // La vista se lee con el cliente de servicio, siempre filtrada por el
    // comprador de la sesión. Una sesión no la consulta directo: la vista une
    // tiendas y productos, y con la RLS de esas tablas un pedido de una tienda o
    // un producto ya desactivados desaparecería del historial.
    const service = createSupabaseServiceClient();
    let query = service
      .from('orders_detail_view')
      .select('*', { count: 'exact' })
      .eq('buyer_id', user.id);

    if (storeId) query = query.eq('store_id', storeId);
    if (status) query = query.eq('status', status as any);

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // La factura de cada pedido de la página, en una sola consulta. Los ids ya
    // son solo del comprador de la sesión.
    const orderIds = [...new Set((data ?? []).map((o) => o.order_id).filter((id): id is string => !!id))];
    const { data: invoices, error: invoicesError } = orderIds.length
      ? await service.from('siigo_invoices').select(INVOICE_LINK_COLUMNS).in('order_id', orderIds)
      : { data: [], error: null };
    if (invoicesError) {
      return NextResponse.json({ error: invoicesError.message }, { status: 400 });
    }
    const invoiceByOrder = new Map((invoices as SiigoInvoiceRow[]).map((i) => [i.order_id, i]));

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      data: (data ?? []).map((o) => ({
        ...o,
        invoice: invoiceLinkFor(o.order_id ? invoiceByOrder.get(o.order_id) : null, 'buyer'),
      })),
      meta: {
        total,
        page,
        pageSize: limit,
        totalPages
      }
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
