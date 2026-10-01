import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { requirePermission } from '@/lib/auth/require-permission';

/**
 * Los patinadores de una plaza.
 *
 * `marketplace_runners` no tiene políticas, así que se lee y se escribe con el
 * cliente de servicio después de comprobar el permiso sobre las plazas.
 */

interface Patinador {
  userId: string;
  name: string;
  email: string | null;
  assigned: boolean;
}

/** Todos los usuarios con rol de patinador, marcando los que atienden esta plaza. */
async function listar(service: SupabaseClient<any>, marketplaceId: string): Promise<Patinador[]> {
  const [{ data: usuarios, error }, { data: asignados }] = await Promise.all([
    service
      .from('profiles')
      .select('id, full_name, email, is_active, roles!inner ( name )')
      .eq('roles.name', 'runner')
      .order('full_name', { ascending: true }),
    service
      .from('marketplace_runners')
      .select('user_id')
      .eq('marketplace_id', marketplaceId)
      .eq('is_active', true),
  ]);

  if (error) throw new Error(error.message);

  const deLaPlaza = new Set((asignados ?? []).map((a: any) => a.user_id));

  return (usuarios ?? [])
    .filter((u: any) => u.is_active !== false)
    .map((u: any) => ({
      userId: u.id,
      name: u.full_name || u.email || 'Sin nombre',
      email: u.email ?? null,
      assigned: deLaPlaza.has(u.id),
    }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const denied = await requirePermission(supabase, 'marketplace', 'read');
    if (denied) return denied;

    const { id } = await params;
    const service = createSupabaseServiceClient() as unknown as SupabaseClient<any>;

    return NextResponse.json({ data: await listar(service, id) }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error cargando los patinadores';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Deja asignados a la plaza exactamente los usuarios de `userIds`. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const denied = await requirePermission(supabase, 'marketplace', 'update');
    if (denied) return denied;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const userIds: string[] = Array.isArray(body.userIds) ? body.userIds.map(String) : [];

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const service = createSupabaseServiceClient() as unknown as SupabaseClient<any>;

    // Solo se puede asignar a quien tiene el rol: la lista sale de la base, no
    // de lo que mande el navegador.
    const candidatos = await listar(service, id);
    const validos = new Set(candidatos.map((c) => c.userId));
    const elegidos = Array.from(new Set(userIds)).filter((u) => validos.has(u));

    // Los que salen se desactivan en vez de borrarse: queda quién atendió la plaza.
    const { error: bajaError } = await service
      .from('marketplace_runners')
      .update({ is_active: false })
      .eq('marketplace_id', id);
    if (bajaError) throw new Error(bajaError.message);

    if (elegidos.length > 0) {
      const { error: altaError } = await service.from('marketplace_runners').upsert(
        elegidos.map((userId) => ({
          marketplace_id: id,
          user_id: userId,
          is_active: true,
          created_by: user?.id ?? null,
        })),
        { onConflict: 'marketplace_id,user_id' }
      );
      if (altaError) throw new Error(altaError.message);
    }

    return NextResponse.json({ data: await listar(service, id) }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error guardando los patinadores';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
