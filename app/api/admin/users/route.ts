import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { requirePermission } from '@/lib/auth/require-permission';
import { fetchAuthActivity } from '@/lib/supabase/auth-activity';
import { getCurrentLegalDocuments } from '@/lib/legal/current-documents';

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
        updated_at,
        anonymized_at,
        is_active,
        terms_accepted_at,
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

    // Último ingreso y verificación del correo viven en `auth.users`, no en
    // `profiles`: se leen aparte y se cruzan por id.
    const actividad = await fetchAuthActivity(service);

    // La inactivación vigente de cada uno, para poder decir por qué y hasta
    // cuándo. Se piden solo las de los usuarios inactivos que se van a mostrar:
    // en una lista de 21 personas las inactivas son un puñado.
    const inactivos = (data || []).filter((p) => p.is_active === false).map((p) => p.id);

    const { data: desactivaciones } = inactivos.length
      ? await service
          .from('user_deactivations')
          .select('user_id, reason, period, until, created_at, actor:profiles!user_deactivations_actor_id_fkey ( full_name )')
          .in('user_id', inactivos)
          .is('lifted_at', null)
          .order('created_at', { ascending: false })
      : { data: [] };

    // La más reciente por usuario. No debería haber dos vivas a la vez, pero si
    // las hubiera manda la última, que es la que impuso el bloqueo actual.
    const porUsuario = new Map<string, any>();
    for (const d of desactivaciones ?? []) {
      if (!porUsuario.has(d.user_id)) porUsuario.set(d.user_id, d);
    }

    /**
     * La constancia de haber aceptado los documentos legales.
     *
     * Se resuelve para toda la lista de una vez —una consulta de vigentes y una
     * de aceptaciones— y no con `getPendingLegalDocuments` por usuario, que
     * serían dos consultas por cada uno.
     */
    const vigentes = await getCurrentLegalDocuments(service);
    const idsVigentes = vigentes.map((d) => d.id);
    const ids = (data || []).map((p) => p.id);

    const { data: aceptaciones } = ids.length
      ? await service
          .from('legal_acceptances')
          .select('user_id, document_id, accepted_at')
          .in('user_id', ids)
      : { data: [] };

    /** Por usuario: cuándo fue la última y qué documentos vigentes ya aceptó. */
    const legalPorUsuario = new Map<string, { ultima: string | null; vigentesAceptados: Set<string> }>();
    for (const a of aceptaciones ?? []) {
      const actual = legalPorUsuario.get(a.user_id) ?? { ultima: null, vigentesAceptados: new Set<string>() };
      if (!actual.ultima || a.accepted_at > actual.ultima) actual.ultima = a.accepted_at;
      if (idsVigentes.includes(a.document_id)) actual.vigentesAceptados.add(a.document_id);
      legalPorUsuario.set(a.user_id, actual);
    }

    const users = (data || []).map((p) => ({
      id: p.id,
      fullName: p.full_name,
      email: p.email,
      phone: p.phone,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      lastSignInAt: actividad.get(p.id)?.lastSignInAt ?? null,
      emailVerifiedAt: actividad.get(p.id)?.emailVerifiedAt ?? null,
      anonymizedAt: p.anonymized_at,
      isActive: p.is_active !== false,
      deactivation: porUsuario.has(p.id)
        ? {
            reason: porUsuario.get(p.id).reason as string,
            period: porUsuario.get(p.id).period as string,
            until: (porUsuario.get(p.id).until as string | null) ?? null,
            createdAt: porUsuario.get(p.id).created_at as string,
            actorName: (porUsuario.get(p.id).actor?.full_name as string | null) ?? null,
          }
        : null,
      legal: {
        lastAcceptedAt: legalPorUsuario.get(p.id)?.ultima ?? null,
        /**
         * El superadmin nunca queda pendiente, con la misma regla y por la
         * misma razón que `getPendingLegalDocuments`: si un PDF se sube mal,
         * alguien tiene que poder entrar a arreglarlo.
         */
        pendingCount:
          p.roles?.name === 'superadmin'
            ? 0
            : idsVigentes.length - (legalPorUsuario.get(p.id)?.vigentesAceptados.size ?? 0),
        /**
         * La aceptación que registra el formulario de registro, anterior al
         * sistema de documentos. Solo la tienen compradores: tenderos y
         * administradores entran por invitación y ese flujo nunca la pidió.
         */
        signupAcceptedAt: p.terms_accepted_at,
      },
      role: p.roles ? { id: p.roles.id, name: p.roles.name, label: p.roles.label } : null,
      stores: (p.store_members || [])
        .map((m) => m.stores)
        .filter((s): s is { id: string; name: string } => !!s),
    }));

    return NextResponse.json(
      { data: users, publishedLegalDocuments: vigentes.length },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
