import { NextResponse } from 'next/server';
import { getAuthenticatedClient, verifyPermission } from '@/lib/supabase/auth-helpers';
import { getStoragePublicUrl } from '@/lib/supabase/utils';

export async function GET(
  request: Request,
  { params }: { params: any }
) {
  try {
    const resolvedParams = await params;
    const storeId = resolvedParams.storeId;

    if (!storeId) {
      return NextResponse.json({ error: 'storeId is required' }, { status: 400 });
    }

    const { supabase, user, error: authError } = await getAuthenticatedClient(request);
    
    if (authError || !supabase || !user) {
      return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
    }

    const hasAccess = await verifyPermission(supabase, user.id, 'catalog', 'read');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('store_products')
      .select(`
        *,
        catalog_products ( name, image_url, description, category_id, categories ( name ) ),
        measurement_units ( name, abbreviation )
      `)
      .eq('store_id', storeId)
      .eq('is_active', true);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const productsWithUrls = (data || []).map(product => {
      let imagePublicUrl = null;
      if (product.catalog_products?.image_url) {
        imagePublicUrl = getStoragePublicUrl('products', product.catalog_products.image_url);
      }
      return {
        ...product,
        imagePublicUrl
      };
    });

    return NextResponse.json({ data: productsWithUrls }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
