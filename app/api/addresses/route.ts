import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sanitizeAddress } from '@/lib/addresses/sanitize-address';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabase
      .from('delivery_addresses')
      .select('*')
      .eq('buyer_id', user.id)
      .order('is_default', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data }, { status: 200 });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();

    // Lista explícita de campos: el spread crudo dejaba escribir cualquier
    // columna, y aceptaba coordenadas vacías que Pibox no detecta como faltantes.
    const { data: address, error: invalid } = sanitizeAddress(body);
    if (invalid || !address) {
      return NextResponse.json({ error: invalid }, { status: 400 });
    }

    // If new address is default, unset others first
    if (address.is_default) {
      await supabase
        .from('delivery_addresses')
        .update({ is_default: false })
        .eq('buyer_id', user.id);
    }

    const { data, error } = await supabase
      .from('delivery_addresses')
      .insert({ ...address, buyer_id: user.id })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data }, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}
