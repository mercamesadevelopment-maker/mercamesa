import { NextResponse } from 'next/server';
import { getAuthenticatedClient, verifyPermission } from '@/lib/supabase/auth-helpers';

export async function GET(request: Request) {
  try {
    const { supabase, user, error: authError } = await getAuthenticatedClient(request);
    
    if (authError || !supabase || !user) {
      return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
    }

    const hasAccess = await verifyPermission(supabase, user.id, 'catalog', 'read');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('store_id');
    const storeProductId = searchParams.get('store_product_id');

    let query = supabase
      .from('product_stock_movements')
      .select(`
        id,
        store_product_id,
        store_id,
        type,
        quantity,
        reference_id,
        reference_type,
        notes,
        created_at,
        registered_by,
        profiles!registered_by (
          full_name,
          email
        )
      `)
      .order('created_at', { ascending: false });

    if (storeId) {
      query = query.eq('store_id', storeId);
    }
    if (storeProductId) {
      query = query.eq('store_product_id', storeProductId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
