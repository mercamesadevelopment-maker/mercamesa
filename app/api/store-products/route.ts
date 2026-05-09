import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { Database } from '../../../types/database_generated';

type StoreProductInsert = Database['public']['Tables']['store_products']['Insert'];

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get('store_id');

  let query = supabase.from('store_products').select(`
    *,
    catalog_products ( name, image_url, categories ( name ) ),
    stores ( name, marketplaces ( name ) ),
    measurement_units ( abbreviation )
  `);
  
  if (storeId) {
    query = query.eq('store_id', storeId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data }, { status: 200 });
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    const insertData: StoreProductInsert = {
      catalog_product_id: body.catalog_product_id,
      store_id: body.store_id,
      unit_id: body.unit_id,
      price_per_unit: Number(body.price_per_unit),
      stock: Number(body.stock || 0),
      min_order_qty: Number(body.min_order_qty || 1),
      wholesale_price: body.wholesale_price ? Number(body.wholesale_price) : null,
      wholesale_min_qty: body.wholesale_min_qty ? Number(body.wholesale_min_qty) : null,
      is_active: body.is_active ?? true,
    };

    const { data, error } = await supabase.from('store_products').insert(insertData).select().single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
