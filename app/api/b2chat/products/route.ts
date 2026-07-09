import { NextResponse } from 'next/server';
import { getAuthenticatedClient, verifyPermission } from '@/lib/supabase/auth-helpers';

export async function GET(request: Request) {
  try {
    const { supabase, user, error: authError } = await getAuthenticatedClient(request);
    
    if (authError || !supabase || !user) {
      return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
    }

    const hasAccess = await verifyPermission(supabase, user.id, 'products', 'read');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const categoryId = searchParams.get('category_id');

    let query = supabase.from('catalog_products').select(`
      *,
      categories ( name ),
      measurement_units ( abbreviation )
    `);

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }
    
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const productsWithPublicUrls = (data || []).map((product) => {
      let imageSignedUrl = null;
      if (product.image_url) {
        const { data: publicData } = supabase.storage
          .from('products')
          .getPublicUrl(product.image_url);
        imageSignedUrl = publicData.publicUrl;
      }
      return { ...product, imageSignedUrl };
    });

    return NextResponse.json({ data: productsWithPublicUrls }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
