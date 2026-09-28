import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { requirePermission } from '@/lib/auth/require-permission';

/** Módulo desde el que se administran los permisos: sin su `read`, nadie podría
 *  volver a entrar a esta pantalla a arreglarlo. */
const MODULO_DE_CONFIGURACION = 'system-settings';
const ROL_QUE_NO_SE_QUEDA_FUERA = 'superadmin';

/**
 * Fija qué roles pueden VER un módulo: la acción `read` de `role_permissions`,
 * que decide si aparece en el menú y si `proxy.ts` deja entrar a su ruta.
 *
 * Recibe la lista completa y aplica la diferencia:
 *   - a un rol que se agrega se le da solo `read`;
 *   - a un rol que se quita se le quitan TODAS sus acciones sobre el módulo,
 *     porque un rol que no ve un módulo no debe poder actuar sobre él por la API.
 *
 * `role_permissions` no admite escrituras desde la sesión del usuario (RLS), así
 * que se escribe con la llave de servicio, después de comprobar el permiso.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: moduleId } = await params;
    const supabase = await createClient();

    const denied = await requirePermission(
      supabase,
      'system-settings',
      'update',
      'No tienes permisos para cambiar quién ve los módulos'
    );
    if (denied) return denied;

    const body = await request.json();
    const pedidos: unknown = body?.role_ids;
    if (!Array.isArray(pedidos) || !pedidos.every((r) => typeof r === 'string')) {
      return NextResponse.json({ error: 'role_ids debe ser una lista de ids de rol.' }, { status: 400 });
    }
    const roleIds = [...new Set(pedidos as string[])];

    const service = createSupabaseServiceClient();

    const [{ data: modulo }, { data: roles }, { data: lectura }] = await Promise.all([
      service.from('modules').select('id, key').eq('id', moduleId).maybeSingle(),
      service.from('roles').select('id, name'),
      service.from('actions').select('id').eq('name', 'read').single(),
    ]);

    if (!modulo) {
      return NextResponse.json({ error: 'El módulo no existe.' }, { status: 404 });
    }
    if (!lectura) {
      return NextResponse.json({ error: 'No se encontró la acción de lectura.' }, { status: 500 });
    }

    const existentes = new Set((roles ?? []).map((r) => r.id));
    const desconocidos = roleIds.filter((r) => !existentes.has(r));
    if (desconocidos.length > 0) {
      return NextResponse.json({ error: 'Alguno de los roles no existe.' }, { status: 400 });
    }

    if (modulo.key === MODULO_DE_CONFIGURACION) {
      const protegido = (roles ?? []).find((r) => r.name === ROL_QUE_NO_SE_QUEDA_FUERA);
      if (protegido && !roleIds.includes(protegido.id)) {
        return NextResponse.json(
          { error: 'El superadministrador no puede perder el acceso a Configuración: nadie podría devolvérselo.' },
          { status: 400 }
        );
      }
    }

    const { data: actuales, error: actualesError } = await service
      .from('role_permissions')
      .select('role_id')
      .eq('module_id', moduleId)
      .eq('action_id', lectura.id);

    if (actualesError) {
      console.error('admin/modules/read-roles: no se pudieron leer los permisos', actualesError);
      return NextResponse.json({ error: 'No se pudieron leer los permisos actuales.' }, { status: 500 });
    }

    const conLectura = new Set((actuales ?? []).map((p) => p.role_id));
    const agregar = roleIds.filter((r) => !conLectura.has(r));
    const quitar = [...conLectura].filter((r) => !roleIds.includes(r));

    if (agregar.length > 0) {
      const { error } = await service
        .from('role_permissions')
        .upsert(
          agregar.map((role_id) => ({ role_id, module_id: moduleId, action_id: lectura.id })),
          { onConflict: 'role_id,module_id,action_id', ignoreDuplicates: true }
        );
      if (error) {
        console.error('admin/modules/read-roles: no se pudo dar lectura', error);
        return NextResponse.json({ error: 'No se pudieron guardar los permisos.' }, { status: 500 });
      }
    }

    if (quitar.length > 0) {
      const { error } = await service
        .from('role_permissions')
        .delete()
        .eq('module_id', moduleId)
        .in('role_id', quitar);
      if (error) {
        console.error('admin/modules/read-roles: no se pudieron quitar permisos', error);
        return NextResponse.json({ error: 'No se pudieron quitar los permisos.' }, { status: 500 });
      }
    }

    return NextResponse.json({ added: agregar.length, removed: quitar.length }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
