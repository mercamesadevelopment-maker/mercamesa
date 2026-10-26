import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { requirePermission } from '@/lib/auth/require-permission';
import { sendEmail, adminInvitationEmail } from '@/lib/email/resend';
import { generateInviteLink } from '@/lib/auth/invite-link';

/**
 * Invitar a alguien a administrar la plataforma.
 *
 * Hasta ahora el único flujo de invitación era el de miembros de tienda, y
 * sumar un administrador se hacía a mano contra la base. El enum
 * `invitation_type` ya traía el valor `'admin'` sin que nadie lo usara.
 *
 * Solo el superadmin invita, a administrar o a llevar la contabilidad. Se exige
 * `users:create`, que hoy únicamente él tiene. La lista de roles invitables es
 * cerrada a propósito: si llegara del navegador, esto sería una forma de
 * asignarse cualquier rol.
 */

const ROLES_INVITABLES = ['admin', 'superadmin', 'accountant'] as const;
type RolInvitable = (typeof ROLES_INVITABLES)[number];

const DIAS_VIGENCIA = 7;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const denied = await requirePermission(
      supabase,
      'users',
      'create',
      'No tienes permisos para invitar administradores'
    );
    if (denied) return denied;

    const { data: { user: actor } } = await supabase.auth.getUser();
    if (!actor) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    // Supabase guarda los correos en minúscula; normalizar acá evita que una
    // mayúscula haga pasar por nuevo un correo que ya existe.
    const email = String(body.email ?? '').trim().toLowerCase();
    const roleName = body.roleName as RolInvitable;

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Escribe un correo válido.' }, { status: 400 });
    }

    if (!ROLES_INVITABLES.includes(roleName)) {
      return NextResponse.json(
        { error: 'Solo puedes invitar con el rol de administrador, super administrador o auxiliar contable.' },
        { status: 400 }
      );
    }

    const service = createSupabaseServiceClient();

    const { data: rol } = await service
      .from('roles')
      .select('id, label')
      .eq('name', roleName)
      .maybeSingle();

    if (!rol) {
      return NextResponse.json({ error: 'El rol no existe.' }, { status: 400 });
    }

    const { data: yaExiste } = await service
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (yaExiste) {
      return NextResponse.json(
        { error: 'Ese correo ya tiene una cuenta en MercaMesa. Cámbiale el rol en vez de invitarlo.' },
        { status: 400 }
      );
    }

    const ahora = new Date();

    const { data: pendiente } = await service
      .from('invitations')
      .select('id, expires_at')
      .eq('email', email)
      .is('accepted_at', null)
      .gt('expires_at', ahora.toISOString())
      .maybeSingle();

    if (pendiente) {
      return NextResponse.json(
        { error: 'Ese correo ya tiene una invitación pendiente. Cancélala antes de volver a invitar.' },
        { status: 400 }
      );
    }

    const origin = request.headers.get('origin') || new URL(request.url).origin;

    // Sin enviar correo, para mandarlo con la plantilla de la plataforma. Sirve
    // también si una invitación anterior ya creó la cuenta.
    const actionLink = await generateInviteLink(service, email, `${origin}/accept-invite`);

    if (!actionLink) {
      return NextResponse.json(
        { error: 'No se pudo crear la invitación. Vuelve a intentarlo.' },
        { status: 500 }
      );
    }

    const expires = new Date();
    expires.setDate(expires.getDate() + DIAS_VIGENCIA);

    // La fila va ANTES del correo: si se guardara después y el envío fallara,
    // el enlace ya habría creado la cuenta en `auth.users` y quedaría un
    // usuario sin invitación que lo respalde, imposible de completar.
    const { data: invitacion, error: dbError } = await service
      .from('invitations')
      .insert({
        email,
        role: rol.id,
        invitation_type: 'admin',
        invited_by: actor.id,
        token: crypto.randomUUID(),
        expires_at: expires.toISOString(),
      })
      .select('id')
      .single();

    if (dbError) {
      console.error('admin/users/invite: no se pudo registrar la invitación', dbError);
      return NextResponse.json(
        { error: 'No se pudo crear la invitación. Vuelve a intentarlo.' },
        { status: 500 }
      );
    }

    const { data: perfilActor } = await service
      .from('profiles')
      .select('full_name')
      .eq('id', actor.id)
      .maybeSingle();

    try {
      await sendEmail({
        to: email,
        subject: 'Te invitaron a administrar MercaMesa',
        html: adminInvitationEmail(
          perfilActor?.full_name || 'Un administrador',
          rol.label,
          actionLink,
          DIAS_VIGENCIA
        ),
      });
    } catch (err) {
      // Sin correo la invitación es inservible: nadie tiene el enlace. Se
      // deshace para que el correo quede libre y se pueda reintentar, en vez de
      // dejar una invitación pendiente que bloquea el siguiente intento.
      console.error('admin/users/invite: no se pudo enviar el correo', err);
      await service.from('invitations').delete().eq('id', invitacion.id);
      return NextResponse.json(
        { error: 'No pudimos enviar la invitación por correo. Intenta de nuevo en unos minutos.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ invited: true, email }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Las invitaciones de administrador que siguen en pie. */
export async function GET() {
  try {
    const supabase = await createClient();

    const denied = await requirePermission(supabase, 'users', 'read');
    if (denied) return denied;

    const service = createSupabaseServiceClient();

    const { data, error } = await service
      .from('invitations')
      .select('id, email, role, created_at, expires_at, invited_by')
      .eq('invitation_type', 'admin')
      .is('accepted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('admin/users/invite: no se pudieron listar', error);
      return NextResponse.json(
        { error: 'No se pudieron cargar las invitaciones.' },
        { status: 500 }
      );
    }

    // `invitations.role` guarda el uuid del rol como texto, no como clave
    // foránea, así que no se puede embeber: se cruza acá.
    const { data: roles } = await service.from('roles').select('id, label');
    const etiqueta = new Map((roles ?? []).map((r) => [r.id, r.label]));

    const { data: actores } = await service.from('profiles').select('id, full_name');
    const nombre = new Map((actores ?? []).map((p) => [p.id, p.full_name]));

    return NextResponse.json(
      {
        data: (data ?? []).map((i) => ({
          id: i.id,
          email: i.email,
          roleLabel: etiqueta.get(i.role) ?? 'Sin rol',
          createdAt: i.created_at,
          expiresAt: i.expires_at,
          invitedByName: i.invited_by ? nombre.get(i.invited_by) ?? null : null,
          expired: new Date(i.expires_at) <= new Date(),
        })),
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Cancela una invitación pendiente. */
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();

    const denied = await requirePermission(
      supabase,
      'users',
      'create',
      'No tienes permisos para cancelar invitaciones'
    );
    if (denied) return denied;

    const inviteId = new URL(request.url).searchParams.get('inviteId');
    if (!inviteId) {
      return NextResponse.json({ error: 'Falta la invitación a cancelar.' }, { status: 400 });
    }

    const service = createSupabaseServiceClient();

    // El filtro por tipo evita que esta ruta pueda borrar invitaciones de
    // miembros de tienda, que no son asunto suyo.
    const { error } = await service
      .from('invitations')
      .delete()
      .eq('id', inviteId)
      .eq('invitation_type', 'admin');

    if (error) {
      console.error('admin/users/invite: no se pudo cancelar', error);
      return NextResponse.json({ error: 'No se pudo cancelar la invitación.' }, { status: 500 });
    }

    return NextResponse.json({ cancelled: true }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
