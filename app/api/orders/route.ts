import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import type { CreateOrderPayload } from '@/lib/orders/types';
import { PricingConfigError } from '@/lib/pricing/settings';
import { DeliveryQuoteUnavailableError } from '@/lib/pricing/delivery-quote';
import { OrderDraftError } from '@/lib/orders/build-order-draft';
import { createOrder } from '@/lib/orders/create-order';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateOrderPayload = await request.json();
    const service = createSupabaseServiceClient() as unknown as SupabaseClient<any>;

    const { status, body: respuesta } = await createOrder(supabase, service, user.id, body);
    return NextResponse.json(respuesta, { status });
  } catch (error: unknown) {
    if (error instanceof OrderDraftError) {
      return NextResponse.json(
        { error: error.message, ...(error.code ? { code: error.code } : {}), ...error.extra },
        { status: error.status }
      );
    }
    // Sin costo de domicilio confiable el pedido no se completa, y se corta
    // ANTES de insertar nada: crear la orden y dejarla sin envío calculado sería
    // peor que rechazarla.
    if (error instanceof DeliveryQuoteUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof PricingConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
