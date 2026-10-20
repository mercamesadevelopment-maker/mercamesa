import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { managesAnyStore } from '@/lib/auth/can-manage-store';
import { findSaleClient, saveSaleClient } from '@/lib/stores/sale-clients';

/**
 * El cliente de una venta de mostrador: buscarlo por documento o correo, y
 * registrarlo.
 *
 * Antes lo hacía el navegador directo en la base, leyendo `clients` y
 * `profiles` completas. Ahora solo la gente de una tienda (o un admin) pregunta,
 * y solo recibe la coincidencia exacta.
 */
async function autorizar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  if (!(await managesAnyStore(supabase, user.id))) {
    return { error: NextResponse.json({ error: 'Solo una tienda registra ventas.' }, { status: 403 }) };
  }
  return { service: createSupabaseServiceClient() as unknown as SupabaseClient<any> };
}

export async function GET(request: Request) {
  try {
    const { service, error } = await autorizar();
    if (error) return error;

    const q = new URL(request.url).searchParams.get('q') ?? '';
    return NextResponse.json({ data: await findSaleClient(service, q) }, { status: 200 });
  } catch (error) {
    console.error('seller/clients GET:', error);
    return NextResponse.json({ error: 'No se pudo buscar el cliente.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { service, error } = await autorizar();
    if (error) return error;

    const body = await request.json().catch(() => ({}));
    const document_number = typeof body.document_number === 'string' ? body.document_number.trim() : '';
    const full_name = typeof body.full_name === 'string' ? body.full_name.trim() : '';
    if (!document_number || !full_name) {
      return NextResponse.json({ error: 'El documento y el nombre son obligatorios.' }, { status: 400 });
    }

    const data = await saveSaleClient(service, {
      profile_id: body.profile_id || null,
      document_number,
      identification_type_id: body.identification_type_id || null,
      full_name,
      email: typeof body.email === 'string' && body.email.trim() ? body.email.trim() : null,
      phone: typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : null,
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('seller/clients POST:', error);
    return NextResponse.json({ error: 'No se pudo guardar el cliente.' }, { status: 500 });
  }
}
