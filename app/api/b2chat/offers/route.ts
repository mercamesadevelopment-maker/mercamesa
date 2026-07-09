import { NextResponse } from 'next/server';
import { getAuthenticatedClient, verifyPermission } from '@/lib/supabase/auth-helpers';
import { getStoragePublicUrl } from '@/lib/supabase/utils';

export async function GET(request: Request) {
  try {
    const { supabase, user, error: authError } = await getAuthenticatedClient(request);
    
    if (authError || !supabase || !user) {
      return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
    }

    const hasAccess = await verifyPermission(supabase, user.id, 'offers', 'read');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('store_id');

    let query = supabase.from('store_offers').select(`
      *,
      store_products!inner (
        id,
        store_id,
        catalog_products ( name, image_url )
      )
    `)
    .eq('is_active', true);

    if (storeId) {
      query = query.eq('store_products.store_id', storeId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const offersWithUrls = (data || []).map((offer: any) => {
      let imagePublicUrl = null;
      const imgPath = offer.store_products?.catalog_products?.image_url;
      if (imgPath) {
        imagePublicUrl = getStoragePublicUrl('products', imgPath);
      }
      return {
        ...offer,
        imagePublicUrl
      };
    });

    return NextResponse.json({ data: offersWithUrls }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
