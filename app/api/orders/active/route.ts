import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { loadActiveBuyerOrders } from '@/lib/orders/active-buyer-orders';

/**
 * Los pedidos en curso del comprador de la sesión, con su domicilio. Los usa la
 * página de inicio y la burbuja del pedido (`features/orders/active-orders-context.tsx`).
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const orders = await loadActiveBuyerOrders(createSupabaseServiceClient() as any, user.id);
    return NextResponse.json({ data: orders });
  } catch (error) {
    console.error('GET /api/orders/active:', error);
    return NextResponse.json({ error: 'No se pudieron cargar tus pedidos.' }, { status: 500 });
  }
}
