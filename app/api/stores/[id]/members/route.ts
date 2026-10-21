import { NextResponse } from 'next/server';
import { createClient } from '../../../../../lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { requirePermission } from '@/lib/auth/require-permission';
import { canManageStore } from '@/lib/auth/can-manage-store';
import { sendEmail, storeInvitationEmail } from '@/lib/email/resend';
import { generateInviteLink } from '@/lib/auth/invite-link';

/** Días que dura una invitación de miembro de tienda, al crearla y al reenviarla. */
const DIAS_VIGENCIA = 7;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // El equipo y las invitaciones de una tienda son de su gente (o de un admin).
    // Antes bastaba con tener sesión para ver, invitar o sacar a cualquiera.
    if (!(await canManageStore(supabase, id, user.id))) {
      return NextResponse.json({ error: 'No tienes permisos sobre esta tienda.' }, { status: 403 });
    }

    // Ya se comprobó que gestiona la tienda. Los nombres y correos del equipo y
    // las invitaciones se leen con el cliente de servicio: un usuario no lee
    // perfiles ajenos ni la tabla de invitaciones.
    const service = createSupabaseServiceClient();
    const { data: members, error } = await service
      .from('store_members')
      .select(`
        id,
        user_id,
        role_id,
        created_at,
        profiles!user_id (
          id,
          full_name,
          email,
          phone
        ),
        roles (
          id,
          name,
          label
        )
      `)
      .eq('store_id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Also fetch pending invitations for this store
    const { data: invitations } = await service
      .from('invitations')
      .select(`
        id,
        email,
        role,
        created_at,
        expires_at
      `)
      .eq('store_id', id)
      .eq('invitation_type', 'store_member');

    // Fetch the role definitions to map roles in invitations
    const { data: roles } = await supabase.from('roles').select('id, name, label');
    const rolesMap = (roles || []).reduce((acc: Record<string, any>, role) => {
      acc[role.id] = role;
      return acc;
    }, {});

    const mappedInvitations = (invitations || []).map(invite => ({
      id: invite.id,
      email: invite.email,
      role_id: invite.role,
      roles: rolesMap[invite.role] || { name: 'unknown', label: 'Invitado' },
      is_pending: true,
      created_at: invite.created_at,
      expires_at: invite.expires_at,
      // Vencida, el enlace ya no sirve: `accept-invite` la rechaza. Es lo que
      // habilita «Reenviar» en el panel.
      expired: new Date(invite.expires_at) <= new Date(),
    }));

    return NextResponse.json({ 
      data: {
        members: members || [],
        invitations: mappedInvitations
      }
    }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // El equipo y las invitaciones de una tienda son de su gente (o de un admin).
    // Antes bastaba con tener sesión para ver, invitar o sacar a cualquiera.
    if (!(await canManageStore(supabase, id, user.id))) {
      return NextResponse.json({ error: 'No tienes permisos sobre esta tienda.' }, { status: 403 });
    }

    const { email, role_id } = await request.json();

    if (!email || !role_id) {
      return NextResponse.json({ error: 'Email y Rol son requeridos.' }, { status: 400 });
    }

    const service = createSupabaseServiceClient();

    // 1. Check if user exists in profiles table
    const { data: profile } = await service
      .from('profiles')
      .select('id, full_name')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (profile) {
      // 1.1 Existing user: check if already a member
      const { data: existingMember } = await supabase
        .from('store_members')
        .select('id')
        .eq('store_id', id)
        .eq('user_id', profile.id)
        .maybeSingle();

      if (existingMember) {
        return NextResponse.json({ error: 'El usuario ya es miembro de esta tienda.' }, { status: 400 });
      }

      // 1.2 Insert into store_members
      const { error: insertError } = await supabase
        .from('store_members')
        .insert({
          store_id: id,
          user_id: profile.id,
          role_id: role_id,
          invited_by: user.id
        });

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 400 });
      }

      // 1.3 Call notify Edge Function
      try {
        const origin = request.headers.get('origin') || '';
        const edgeUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/notify-store-assignment`;
        
        // Get details
        const { data: roleData } = await supabase.from('roles').select('label').eq('id', role_id).single();
        const { data: storeData } = await supabase.from('stores').select('name').eq('id', id).single();
        
        await fetch(edgeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            fullName: profile.full_name,
            storeName: storeData?.name || 'Tienda',
            roleLabel: roleData?.label || 'Miembro',
            loginUrl: `${origin}/seller/onboarding`
          })
        });
      } catch (efErr) {
        console.error('Error calling notify-store-assignment edge function:', efErr);
      }

      return NextResponse.json({ success: true, memberAdded: true }, { status: 201 });
    } else {
      // 2. New user: check if already invited to this store
      const { data: existingInvite } = await service
        .from('invitations')
        .select('id')
        .eq('store_id', id)
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (existingInvite) {
        return NextResponse.json({ error: 'Ya existe una invitación pendiente para este correo en esta tienda.' }, { status: 400 });
      }

      // 2.1 El enlace, sin enviar correo. Antes era `inviteUserByEmail`, que
      // falla si una invitación anterior (cancelada o vencida) ya creó la cuenta.
      const origin = request.headers.get('origin') || new URL(request.url).origin;
      const actionLink = await generateInviteLink(service, email.trim().toLowerCase(), `${origin}/accept-invite`);

      if (!actionLink) {
        return NextResponse.json({ error: 'No se pudo crear la invitación. Vuelve a intentarlo.' }, { status: 500 });
      }

      // 2.2 La fila va antes del correo: sin ella, la cuenta que crea el enlace
      // quedaría sin invitación que la respalde.
      const expires = new Date();
      expires.setDate(expires.getDate() + DIAS_VIGENCIA);

      const { data: invitacion, error: inviteDbError } = await service
        .from('invitations')
        .insert({
          email: email.trim().toLowerCase(),
          store_id: id,
          role: role_id, // Store role UUID as string in role
          invitation_type: 'store_member',
          invited_by: user.id,
          token: crypto.randomUUID(),
          expires_at: expires.toISOString()
        })
        .select('id')
        .single();

      if (inviteDbError) {
        return NextResponse.json({ error: inviteDbError.message }, { status: 400 });
      }

      // 2.3 El correo, con la plantilla de la plataforma (la misma del reenvío).
      const { data: storeData } = await service.from('stores').select('name').eq('id', id).maybeSingle();
      const { data: roleData } = await service.from('roles').select('label').eq('id', role_id).maybeSingle();
      try {
        await sendEmail({
          to: email.trim().toLowerCase(),
          subject: 'Te invitaron a una tienda en MercaMesa',
          html: storeInvitationEmail(
            storeData?.name || 'una tienda',
            roleData?.label || 'Miembro',
            actionLink,
            DIAS_VIGENCIA
          ),
        });
      } catch (err) {
        // Sin correo nadie tiene el enlace: se deshace para poder reintentar.
        console.error('stores/members: no se pudo enviar el correo', err);
        await service.from('invitations').delete().eq('id', invitacion.id);
        return NextResponse.json(
          { error: 'No pudimos enviar la invitación por correo. Intenta de nuevo en unos minutos.' },
          { status: 502 }
        );
      }

      return NextResponse.json({ success: true, invited: true }, { status: 201 });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // El equipo y las invitaciones de una tienda son de su gente (o de un admin).
    // Antes bastaba con tener sesión para ver, invitar o sacar a cualquiera.
    if (!(await canManageStore(supabase, id, user.id))) {
      return NextResponse.json({ error: 'No tienes permisos sobre esta tienda.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');
    const inviteId = searchParams.get('inviteId');

    if (memberId) {
      // Delete existing member relation
      const { error } = await supabase
        .from('store_members')
        .delete()
        .eq('id', memberId)
        .eq('store_id', id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: 'Miembro eliminado correctamente' }, { status: 200 });
    } else if (inviteId) {
      // Delete pending invitation
      const { error } = await createSupabaseServiceClient()
        .from('invitations')
        .delete()
        .eq('id', inviteId)
        .eq('store_id', id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: 'Invitación cancelada correctamente' }, { status: 200 });
    } else {
      return NextResponse.json({ error: 'Se requiere memberId o inviteId.' }, { status: 400 });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Reenvía una invitación de miembro de tienda: renueva la vigencia y manda un
 * enlace nuevo.
 *
 * La primera invitación ya creó la cuenta en `auth.users`: `generateInviteLink`
 * lo resuelve con el enlace de acceso.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Usa el cliente de servicio, que se salta RLS: el permiso se exige acá.
    const denied = await requirePermission(
      supabase,
      'stores',
      'update',
      'No tienes permisos para reenviar invitaciones'
    );
    if (denied) return denied;

    const inviteId = new URL(request.url).searchParams.get('inviteId');
    if (!inviteId) {
      return NextResponse.json({ error: 'Falta la invitación a reenviar.' }, { status: 400 });
    }

    const service = createSupabaseServiceClient();

    const { data: invite } = await service
      .from('invitations')
      .select('id, email, role, expires_at, stores ( name )')
      .eq('id', inviteId)
      .eq('store_id', id)
      .eq('invitation_type', 'store_member')
      .is('accepted_at', null)
      .maybeSingle();

    if (!invite) {
      return NextResponse.json({ error: 'La invitación ya no existe.' }, { status: 404 });
    }

    const origin = request.headers.get('origin') || new URL(request.url).origin;
    const redirectTo = `${origin}/accept-invite`;

    const actionLink = await generateInviteLink(service, invite.email, redirectTo);

    if (!actionLink) {
      return NextResponse.json(
        { error: 'No se pudo generar el enlace de la invitación. Vuelve a intentarlo.' },
        { status: 500 }
      );
    }

    const { data: rol } = await service
      .from('roles')
      .select('label')
      .eq('id', invite.role)
      .maybeSingle();

    try {
      await sendEmail({
        to: invite.email,
        subject: 'Te invitaron a una tienda en MercaMesa',
        html: storeInvitationEmail(
          (invite as any).stores?.name || 'una tienda',
          rol?.label || 'Miembro',
          actionLink,
          DIAS_VIGENCIA
        ),
      });
    } catch (err) {
      // La vigencia solo se renueva si el correo salió: si no, la invitación
      // seguiría vencida a la vista y se puede reintentar.
      console.error('stores/members: no se pudo enviar el correo', err);
      return NextResponse.json(
        { error: 'No pudimos enviar la invitación por correo. Intenta de nuevo en unos minutos.' },
        { status: 502 }
      );
    }

    const expires = new Date();
    expires.setDate(expires.getDate() + DIAS_VIGENCIA);

    const { error: updateError } = await service
      .from('invitations')
      .update({ expires_at: expires.toISOString() })
      .eq('id', invite.id);

    if (updateError) {
      console.error('stores/members: no se pudo renovar la vigencia', updateError);
      return NextResponse.json({ error: 'No se pudo renovar la invitación.' }, { status: 500 });
    }

    return NextResponse.json({ resent: true, expiresAt: expires.toISOString() }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
