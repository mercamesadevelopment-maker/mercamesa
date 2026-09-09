import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { requirePermission } from '@/lib/auth/require-permission';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    const denied = await requirePermission(
      supabase,
      'users',
      'read',
      'No tienes permisos para ver los usuarios'
    );
    if (denied) return denied;

    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('search') || '').trim();
    const roleId = searchParams.get('role_id');

    // Con la llave de servicio: `profiles` tiene RLS y la pantalla debe listar
    // todos los roles sin excepción. El permiso ya se verificó arriba.
    const service = createSupabaseServiceClient();

    let query = service
      .from('profiles')
      .select(`
        id,
        full_name,
        email,
        phone,
        avatar_url,
        created_at,
        role_id,
        roles ( id, name, label ),
        store_members!store_members_user_id_fkey ( stores ( id, name ) )
      `)
      .order('created_at', { ascending: false });

    if (roleId) {
      query = query.eq('role_id', roleId);
    }

    if (search) {
      // `or` con comas exige escapar el término, o una coma en la búsqueda
      // rompería el filtro en dos condiciones.
      const term = search.replace(/[,()]/g, ' ');
      query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('admin/users: query failed', error);
      return NextResponse.json({ error: 'No se pudieron cargar los usuarios.' }, { status: 500 });
    }

    const users = (data || []).map((p) => ({
      id: p.id,
      fullName: p.full_name,
      email: p.email,
      phone: p.phone,
      createdAt: p.created_at,
      role: p.roles ? { id: p.roles.id, name: p.roles.name, label: p.roles.label } : null,
      stores: (p.store_members || [])
        .map((m) => m.stores)
        .filter((s): s is { id: string; name: string } => !!s),
    }));

    return NextResponse.json({ data: users }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
