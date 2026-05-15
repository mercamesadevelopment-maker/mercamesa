import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { Database } from '../../../types/database_generated';

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

  // Get signed URLs for the products
  const offersWithSignedUrls = await Promise.all(
    (data || []).map(async (offer: any) => {
      let imageSignedUrl = null;
      const imgPath = offer.store_products?.catalog_products?.image_url;
      if (imgPath) {
        const { data: signedData } = await supabase.storage.from('products').createSignedUrl(imgPath, 3600);
        imageSignedUrl = signedData?.signedUrl;
      }
      return { ...offer, imageSignedUrl };
    })
  );

  return NextResponse.json({ data: offersWithSignedUrls }, { status: 200 });
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
