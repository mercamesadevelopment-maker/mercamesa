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

    const { data, error } = await supabase.from('categories').select('*').order('name');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
