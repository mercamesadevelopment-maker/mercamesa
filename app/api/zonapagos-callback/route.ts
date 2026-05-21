import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { ZonapagosCallbackData } from '@/src/features/payment/types/payment.types';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body: ZonapagosCallbackData = await request.json();

    const { str_id_pago: idPago, str_estado: estado, str_opcional1: orderIdFromOpcional } = body;

    if (!idPago || !estado) {
      return NextResponse.json(
        { error: 'Missing required fields: str_id_pago, str_estado' },
        { status: 400 }
      );
    }

    const paymentStatus = mapZonapagosStatus(estado);

    const { data: existingPayment, error: paymentCheckError } = await supabase
      .from('payments')
      .select('id, order_id')
      .eq('str_id_pago', idPago)
      .single();

    if (paymentCheckError && paymentCheckError.code !== 'PGRST116') {
      return NextResponse.json({ error: paymentCheckError.message }, { status: 500 });
    }

    let finalOrderId = existingPayment?.order_id;

    if (existingPayment) {
      const { error: updateError } = await supabase
        .from('payments')
        .update({
          status: paymentStatus,
          callback_response: body,
          updated_at: new Date().toISOString(),
        })
        .eq('str_id_pago', idPago);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    } else {
      // If payment doesn't exist, we use the order ID from optional1
      const orderId = (orderIdFromOpcional as string) || (body.str_opcional1 as string);
      
      if (!orderId) {
        return NextResponse.json({ error: 'Order ID not found in callback' }, { status: 400 });
      }

      finalOrderId = orderId;

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('total')
        .eq('id', orderId)
        .single();

      if (orderError) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      const { error: insertError } = await supabase
        .from('payments')
        .insert({
          order_id: orderId,
          provider: 'zonapagos',
          str_id_pago: idPago,
          status: paymentStatus,
          amount: order.total,
          payment_url: null,
          provider_payment_id: body.str_autorizacion || body.str_referencia || null,
          callback_response: body,
        });

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    if (finalOrderId) {
      const orderStatus = paymentStatus === 'approved' ? 'confirmed' : 'pending';

      const { error: orderUpdateError } = await supabase
        .from('orders')
        .update({
          payment_status: paymentStatus,
          status: orderStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', finalOrderId);

      if (orderUpdateError) {
        return NextResponse.json({ error: orderUpdateError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, idPago, paymentStatus }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function mapZonapagosStatus(estado: string): 'pending' | 'processing' | 'approved' | 'rejected' | 'refunded' | 'disputed' {
  const lower = estado.toLowerCase();

  if (lower.includes('aprob') || lower.includes('approved') || lower.includes('exitoso') || lower.includes('success')) {
    return 'approved';
  }

  if (lower.includes('rechaz') || lower.includes('reject') || lower.includes('fallid') || lower.includes('fail')) {
    return 'rejected';
  }

  if (lower.includes('reembols') || lower.includes('refund')) {
    return 'refunded';
  }

  if (lower.includes('disput') || lower.includes('reclamo')) {
    return 'disputed';
  }

  if (lower.includes('proces') || lower.includes('process')) {
    return 'processing';
  }

  return 'pending';
}
