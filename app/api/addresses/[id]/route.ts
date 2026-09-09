import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sanitizeAddress } from '@/lib/addresses/sanitize-address';

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();

    // Sin esta lista, un `buyer_id` en el cuerpo se escribía igual: el
    // `.eq('buyer_id')` de abajo filtra la fila vieja, no lo que se guarda, así
    // que se podía reasignar una dirección a otra cuenta.
    const { data: address, error: invalid } = sanitizeAddress(body);
    if (invalid || !address) {
      return NextResponse.json({ error: invalid }, { status: 400 });
    }

    // If setting as default, unset others first
    if (address.is_default) {
      await supabase
        .from('delivery_addresses')
        .update({ is_default: false })
        .eq('buyer_id', user.id)
        .neq('id', id);
    }

    const { data, error } = await supabase
      .from('delivery_addresses')
      .update(address)
      .eq('id', id)
      .eq('buyer_id', user.id) // ownership check
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data }, { status: 200 });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { error } = await supabase
      .from('delivery_addresses')
      .delete()
      .eq('id', id)
      .eq('buyer_id', user.id); // ownership check

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ message: 'Deleted successfully' }, { status: 200 });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}
