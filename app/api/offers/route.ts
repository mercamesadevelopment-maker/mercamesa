import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { Database } from '../../../types/database_generated';
import { getSupabaseImageUrl, PRESET_PRODUCT_CARD } from '../../../lib/supabase/supabase-image';

type StoreOfferInsert = Database['public']['Tables']['store_offers']['Insert'];

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get('store_id');

  let query = supabase.from('store_offers').select(`
    *,
    store_products!inner (
      id,
      store_id,
      catalog_products ( name, image_url )
    )
  `);

  if (storeId) {
    query = query.eq('store_products.store_id', storeId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // URLs públicas de los derivados pre-generados (síncrono, sin llamadas de red
  // ni cupo de transformaciones — antes usaba createSignedUrl por oferta, lo
  // que además impedía cualquier caché de CDN al cambiar en cada request).
  const offersWithImageUrls = (data || []).map((offer: any) => {
    const imgPath = offer.store_products?.catalog_products?.image_url;
    const imageSignedUrl = imgPath ? getSupabaseImageUrl('products', imgPath, PRESET_PRODUCT_CARD) : null;
    return { ...offer, imageSignedUrl };
  });

  return NextResponse.json({ data: offersWithImageUrls }, { status: 200 });
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    const insertData: StoreOfferInsert = {
      store_product_id: body.store_product_id,
      label: body.label || null,
      discount_pct: body.discount_pct ? Number(body.discount_pct) : null,
      special_price: body.special_price ? Number(body.special_price) : null,
      starts_at: body.starts_at,
      ends_at: body.ends_at || null,
      is_active: body.is_active ?? true,
    };

    const { data, error } = await supabase.from('store_offers').insert(insertData).select().single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
