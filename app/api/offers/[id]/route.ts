import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { Database } from '../../../../types/database_generated';

type StoreOfferUpdate = Database['public']['Tables']['store_offers']['Update'];

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    const updateData: StoreOfferUpdate = {};
    
    if (body.store_product_id !== undefined) updateData.store_product_id = body.store_product_id;
    if (body.label !== undefined) updateData.label = body.label || null;
    if (body.discount_pct !== undefined) updateData.discount_pct = body.discount_pct ? Number(body.discount_pct) : null;
    if (body.special_price !== undefined) updateData.special_price = body.special_price ? Number(body.special_price) : null;
    if (body.starts_at !== undefined) updateData.starts_at = body.starts_at;
    if (body.ends_at !== undefined) updateData.ends_at = body.ends_at || null;
    if (body.is_active !== undefined) updateData.is_active = Boolean(body.is_active);

    const { data, error } = await supabase.from('store_offers').update(updateData).eq('id', id).select().single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase.from('store_offers').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Deleted successfully' }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
