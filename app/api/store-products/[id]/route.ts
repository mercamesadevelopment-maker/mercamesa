import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { Database } from '../../../../types/database_generated';

type StoreProductUpdate = Database['public']['Tables']['store_products']['Update'];

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
    
    const updateData: StoreProductUpdate = {};
    
    if (body.price_per_unit !== undefined) updateData.price_per_unit = Number(body.price_per_unit);
    if (body.stock !== undefined) updateData.stock = Number(body.stock);
    if (body.min_order_qty !== undefined) updateData.min_order_qty = Number(body.min_order_qty);
    if (body.wholesale_price !== undefined) updateData.wholesale_price = body.wholesale_price ? Number(body.wholesale_price) : null;
    if (body.wholesale_min_qty !== undefined) updateData.wholesale_min_qty = body.wholesale_min_qty ? Number(body.wholesale_min_qty) : null;
    if (body.is_active !== undefined) updateData.is_active = Boolean(body.is_active);
    if (body.unit_id !== undefined) updateData.unit_id = body.unit_id;
    if (body.store_id !== undefined) updateData.store_id = body.store_id;
    if (body.catalog_product_id !== undefined) updateData.catalog_product_id = body.catalog_product_id;

    updateData.last_price_update = new Date().toISOString();

    const { data, error } = await supabase.from('store_products').update(updateData).eq('id', id).select().single();

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

    const { error } = await supabase.from('store_products').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Deleted successfully' }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
