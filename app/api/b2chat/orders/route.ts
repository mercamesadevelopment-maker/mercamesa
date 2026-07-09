import { NextResponse } from 'next/server';
import { getAuthenticatedClient, verifyPermission } from '@/lib/supabase/auth-helpers';

export async function GET(request: Request) {
  try {
    const { supabase, user, error: authError } = await getAuthenticatedClient(request);
    
    if (authError || !supabase || !user) {
      return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
    }

    const hasAccess = await verifyPermission(supabase, user.id, 'orders', 'read');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const clientDocument = searchParams.get('client_document');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    let query = supabase
      .from('orders')
      .select(`
        *,
        clients ( id, document_number, full_name, email, phone ),
        order_items (*)
      `, { count: 'exact' });

    if (clientDocument) {
      query = supabase
        .from('orders')
        .select(`
          *,
          clients!inner ( id, document_number, full_name, email, phone ),
          order_items (*)
        `, { count: 'exact' })
        .eq('clients.document_number', clientDocument);
    }

    if (status) {
      query = query.eq('status', status);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      data,
      pagination: {
        total: count || 0,
        limit,
        offset
      }
    }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
