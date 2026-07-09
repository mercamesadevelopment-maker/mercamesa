import { NextResponse } from 'next/server';
import { getAuthenticatedClient, verifyPermission } from '@/lib/supabase/auth-helpers';
import { getStoragePublicUrl } from '@/lib/supabase/utils';

export async function GET(request: Request) {
  try {
    const { supabase, user, error: authError } = await getAuthenticatedClient(request);
    
    if (authError || !supabase || !user) {
      return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
    }

    const hasAccess = await verifyPermission(supabase, user.id, 'stores', 'read');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const storesWithUrls = (data || []).map(store => ({
      ...store,
      logo_public_url: getStoragePublicUrl('stores', store.logo_url),
      cover_public_url: getStoragePublicUrl('stores', store.cover_image_url)
    }));

    return NextResponse.json({ data: storesWithUrls }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
