import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';

interface ZonapagosTokenNotifyBody {
  int_id_comercio?: number;
  str_usuario?: string;
  str_clave?: string;
  str_id_cliente?: string;
  str_token?: string;
}

export async function POST(request: Request) {
  try {
    const body: ZonapagosTokenNotifyBody = await request.json();

    const expectedIdComercio = parseInt(process.env.ZONAPAGOS_ID_COMERCIO || '0');
    const expectedUsuario = process.env.ZONAPAGOS_USUARIO;
    const expectedClave = process.env.ZONAPAGOS_CLAVE;

    const credentialsMatch =
      body.int_id_comercio === expectedIdComercio &&
      body.str_usuario === expectedUsuario &&
      body.str_clave === expectedClave;

    if (!credentialsMatch) {
      return NextResponse.json({ int_cod_estado: 2, str_mensaje: 'Error de seguridad' }, { status: 200 });
    }

    if (!body.str_id_cliente || !body.str_token) {
      return NextResponse.json(
        { int_cod_estado: 1, str_mensaje: 'Faltan str_id_cliente o str_token' },
        { status: 200 }
      );
    }

    const supabase = createSupabaseServiceClient();

    const { data: buyer, error: buyerError } = await supabase
      .from('profiles')
      .select('id')
      .eq('document_number', body.str_id_cliente)
      .single();

    if (buyerError || !buyer) {
      return NextResponse.json(
        { int_cod_estado: 1, str_mensaje: 'No se encontró el cliente' },
        { status: 200 }
      );
    }

    await supabase
      .from('buyer_payment_methods')
      .update({ is_default: false })
      .eq('buyer_id', buyer.id);

    const { error: upsertError } = await supabase.from('buyer_payment_methods').insert({
      buyer_id: buyer.id,
      type: 'card',
      label: 'Tarjeta guardada',
      zonapagos_token: body.str_token,
      zonapagos_cliente_id: body.str_id_cliente,
      is_default: true,
    });

    if (upsertError) {
      return NextResponse.json(
        { int_cod_estado: 1, str_mensaje: upsertError.message },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { int_cod_estado: 0, str_mensaje: 'Se recibió exitosamente el token' },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    return NextResponse.json({ int_cod_estado: 99, str_mensaje: message }, { status: 200 });
  }
}
