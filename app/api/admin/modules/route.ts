import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { embeddedCount } from '@/lib/db/embedded-count';
import { requirePermission } from '@/lib/auth/require-permission';

export async function GET() {
  try {
    const supabase = await createClient();

    // Esta ruta no comprobaba nada: devolvía el árbol completo de módulos —con
    // sus claves y sus rutas— a quien la llamara, sin sesión siquiera, mientras
    // el POST, el PUT y el DELETE sí exigían permiso. Y ahora además devuelve
    // qué rol entra a qué, que es justamente lo que no se puede publicar.
    const denied = await requirePermission(supabase, 'system-settings', 'read');
    if (denied) return denied;

    const { data, error } = await supabase
      .from('modules')
      // La pista del embed autorreferenciado tiene que ser la columna
      // (`parent_id`) y no la tabla: con `modules!parent_id` PostgREST resolvía
      // la dirección contraria y devolvía los hijos en vez del padre.
      // Esa misma dirección "contraria" sirve para contar los sub-módulos, que
      // son los que impiden borrar un módulo padre.
      .select('*, parent:parent_id(label), children:modules!parent_id(count)')
      .order('sort_order', { ascending: true })
      .order('label', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Quién puede VER cada módulo. Se consulta aparte y no como embed porque el
    // filtro por `actions.name` tendría que ir sobre la tabla anidada, y agrupar
    // acá es más claro que pelear con la sintaxis del embed.
    //
    // Solo la acción `read`: es la que decide si el módulo aparece en el menú y
    // la que exige `proxy.ts` para dejar entrar a la ruta.
    const { data: permisos, error: permisosError } = await supabase
      .from('role_permissions')
      .select('module_id, roles!inner ( id, name, label ), actions!inner ( name )')
      .eq('actions.name', 'read');

    if (permisosError) {
      return NextResponse.json({ error: permisosError.message }, { status: 400 });
    }

    const rolesPorModulo = new Map<string, { id: string; name: string; label: string }[]>();
    for (const fila of (permisos ?? []) as any[]) {
      const rol = fila.roles;
      if (!rol) continue;
      const lista = rolesPorModulo.get(fila.module_id) ?? [];
      lista.push({ id: rol.id, name: rol.name, label: rol.label });
      rolesPorModulo.set(fila.module_id, lista);
    }

    const withCounts = (data ?? []).map((row: any) => {
      const { children, ...module } = row;
      return {
        ...module,
        child_count: embeddedCount(children),
        read_roles: (rolesPorModulo.get(module.id) ?? []).sort((a, b) =>
          a.label.localeCompare(b.label, 'es')
        ),
      };
    });

    return NextResponse.json({ data: withCounts }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { data: canCreate } = await supabase.rpc('has_permission', {
      module_key: 'system-settings',
      action_name: 'create',
    });

    if (!canCreate) {
      return NextResponse.json({ error: 'No tienes permisos para crear módulos' }, { status: 403 });
    }

    const body = await request.json();
    const { key, label, description, icon, path, parent_id, sort_order, is_active } = body;

    if (!key || !label) {
      return NextResponse.json({ error: 'La clave (key) y la etiqueta (label) son requeridas' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('modules')
      .insert({
        key,
        label,
        description: description || null,
        icon: icon || null,
        path: path || null,
        parent_id: parent_id || null,
        sort_order: sort_order ?? 0,
        is_active: is_active ?? true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
