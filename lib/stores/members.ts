import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail, storeInvitationEmail } from '@/lib/email/resend';
import { generateInviteLink } from '@/lib/auth/invite-link';
import { getPublicSupabaseAnonKey, getPublicSupabaseUrl } from '@/lib/env';

/** Días que dura una invitación de miembro de tienda, al crearla y al reenviarla. */
export const INVITATION_DAYS = 7;

export type MembersResult<T = Record<string, unknown>> =
  | { ok: true; status: number; body: T }
  | { ok: false; status: number; message: string };

const falla = (status: number, message: string): MembersResult<never> => ({ ok: false, status, message });

/** El correo como se guarda y se compara: sin espacios y en minúscula. */
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** Hasta cuándo vale una invitación creada o reenviada en `now`. */
export function invitationExpiry(now: Date): Date {
  const expires = new Date(now);
  expires.setDate(expires.getDate() + INVITATION_DAYS);
  return expires;
}

interface InvitationRow {
  id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
}

/** Una invitación pendiente con la forma de un miembro, para pintarla en la misma lista. */
export function toPendingInvitation(invite: InvitationRow, rolesById: Record<string, unknown>, now: Date) {
  return {
    id: invite.id,
    email: invite.email,
    role_id: invite.role,
    roles: rolesById[invite.role] || { name: 'unknown', label: 'Invitado' },
    is_pending: true,
    created_at: invite.created_at,
    expires_at: invite.expires_at,
    // Vencida, el enlace ya no sirve: `accept-invite` la rechaza. Es lo que
    // habilita «Reenviar» en el panel.
    expired: new Date(invite.expires_at) <= now,
  };
}

/**
 * El equipo de una tienda y sus invitaciones pendientes.
 *
 * Quien llama ya comprobó que gestiona la tienda. Los nombres y correos del
 * equipo y las invitaciones se leen con el cliente de servicio: un usuario no
 * lee perfiles ajenos ni la tabla de invitaciones.
 */
export async function listMembers(
  supabase: SupabaseClient<any>,
  service: SupabaseClient<any>,
  storeId: string
): Promise<MembersResult> {
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
    .eq('store_id', storeId);

  if (error) return falla(400, error.message);

  const { data: invitations } = await service
    .from('invitations')
    .select('id, email, role, created_at, expires_at')
    .eq('store_id', storeId)
    .eq('invitation_type', 'store_member');

  // La invitación guarda el id del rol como texto: se le pone el rol completo.
  const { data: roles } = await supabase.from('roles').select('id, name, label');
  const rolesById = Object.fromEntries((roles || []).map((role) => [role.id, role]));

  const now = new Date();
  return {
    ok: true,
    status: 200,
    body: {
      data: {
        members: members || [],
        invitations: (invitations || []).map((invite) => toPendingInvitation(invite, rolesById, now)),
      },
    },
  };
}

interface AddMemberInput {
  storeId: string;
  email: string;
  roleId: string;
  invitedBy: string;
  /** El origen de la app, para los enlaces de los correos. */
  origin: string;
}

/**
 * Suma a alguien al equipo de una tienda.
 *
 * - Si ya tiene cuenta, entra directo a `store_members` y se le avisa.
 * - Si no, se crea la invitación con su enlace y se le manda por correo. Si el
 *   correo no sale, la invitación se deshace para poder reintentar.
 */
export async function addMember(
  supabase: SupabaseClient<any>,
  service: SupabaseClient<any>,
  input: AddMemberInput
): Promise<MembersResult> {
  const { storeId, roleId, invitedBy, origin } = input;
  const email = normalizeEmail(input.email);

  const { data: profile } = await service
    .from('profiles')
    .select('id, full_name')
    .eq('email', email)
    .maybeSingle();

  return profile
    ? addExistingUser(supabase, { storeId, roleId, invitedBy, origin, email, profile })
    : inviteNewUser(service, { storeId, roleId, invitedBy, origin, email });
}

async function addExistingUser(
  supabase: SupabaseClient<any>,
  input: Omit<AddMemberInput, 'email'> & { email: string; profile: { id: string; full_name: string | null } }
): Promise<MembersResult> {
  const { storeId, roleId, invitedBy, origin, email, profile } = input;

  const { data: existingMember } = await supabase
    .from('store_members')
    .select('id')
    .eq('store_id', storeId)
    .eq('user_id', profile.id)
    .maybeSingle();
  if (existingMember) return falla(400, 'El usuario ya es miembro de esta tienda.');

  const { error: insertError } = await supabase.from('store_members').insert({
    store_id: storeId,
    user_id: profile.id,
    role_id: roleId,
    invited_by: invitedBy,
  });
  if (insertError) return falla(400, insertError.message);

  // El aviso lo manda la función de borde `notify-store-assignment`. Si falla,
  // la persona igual quedó en el equipo.
  try {
    const { data: roleData } = await supabase.from('roles').select('label').eq('id', roleId).single();
    const { data: storeData } = await supabase.from('stores').select('name').eq('id', storeId).single();

    await fetch(`${getPublicSupabaseUrl()}/functions/v1/notify-store-assignment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getPublicSupabaseAnonKey()}`,
      },
      body: JSON.stringify({
        email,
        fullName: profile.full_name,
        storeName: storeData?.name || 'Tienda',
        roleLabel: roleData?.label || 'Miembro',
        loginUrl: `${origin}/seller/onboarding`,
      }),
    });
  } catch (efErr) {
    console.error('Error calling notify-store-assignment edge function:', efErr);
  }

  return { ok: true, status: 201, body: { success: true, memberAdded: true } };
}

async function inviteNewUser(
  service: SupabaseClient<any>,
  input: Omit<AddMemberInput, 'email'> & { email: string }
): Promise<MembersResult> {
  const { storeId, roleId, invitedBy, origin, email } = input;

  const { data: existingInvite } = await service
    .from('invitations')
    .select('id')
    .eq('store_id', storeId)
    .eq('email', email)
    .maybeSingle();
  if (existingInvite) return falla(400, 'Ya existe una invitación pendiente para este correo en esta tienda.');

  // El enlace, sin enviar correo. Antes era `inviteUserByEmail`, que falla si
  // una invitación anterior (cancelada o vencida) ya creó la cuenta.
  const actionLink = await generateInviteLink(service, email, `${origin}/accept-invite`);
  if (!actionLink) return falla(500, 'No se pudo crear la invitación. Vuelve a intentarlo.');

  // La fila va antes del correo: sin ella, la cuenta que crea el enlace quedaría
  // sin invitación que la respalde.
  const { data: invitacion, error: inviteDbError } = await service
    .from('invitations')
    .insert({
      email,
      store_id: storeId,
      role: roleId, // El id del rol, como texto.
      invitation_type: 'store_member',
      invited_by: invitedBy,
      token: crypto.randomUUID(),
      expires_at: invitationExpiry(new Date()).toISOString(),
    })
    .select('id')
    .single();
  if (inviteDbError) return falla(400, inviteDbError.message);

  // El correo, con la plantilla de la plataforma (la misma del reenvío).
  const { data: storeData } = await service.from('stores').select('name').eq('id', storeId).maybeSingle();
  const { data: roleData } = await service.from('roles').select('label').eq('id', roleId).maybeSingle();
  try {
    await sendEmail({
      to: email,
      subject: 'Te invitaron a una tienda en MercaMesa',
      html: storeInvitationEmail(storeData?.name || 'una tienda', roleData?.label || 'Miembro', actionLink, INVITATION_DAYS),
    });
  } catch (err) {
    // Sin correo nadie tiene el enlace: se deshace para poder reintentar.
    console.error('stores/members: no se pudo enviar el correo', err);
    await service.from('invitations').delete().eq('id', invitacion.id);
    return falla(502, 'No pudimos enviar la invitación por correo. Intenta de nuevo en unos minutos.');
  }

  return { ok: true, status: 201, body: { success: true, invited: true } };
}

/** Saca a un miembro del equipo o cancela una invitación, siempre de esta tienda. */
export async function removeMemberOrInvitation(
  supabase: SupabaseClient<any>,
  service: SupabaseClient<any>,
  storeId: string,
  ids: { memberId: string | null; inviteId: string | null }
): Promise<MembersResult> {
  if (ids.memberId) {
    const { error } = await supabase.from('store_members').delete().eq('id', ids.memberId).eq('store_id', storeId);
    if (error) return falla(400, error.message);
    return { ok: true, status: 200, body: { success: true, message: 'Miembro eliminado correctamente' } };
  }

  if (ids.inviteId) {
    const { error } = await service.from('invitations').delete().eq('id', ids.inviteId).eq('store_id', storeId);
    if (error) return falla(400, error.message);
    return { ok: true, status: 200, body: { success: true, message: 'Invitación cancelada correctamente' } };
  }

  return falla(400, 'Se requiere memberId o inviteId.');
}

/**
 * Reenvía una invitación de miembro de tienda: renueva la vigencia y manda un
 * enlace nuevo.
 *
 * La primera invitación ya creó la cuenta en `auth.users`: `generateInviteLink`
 * lo resuelve con el enlace de acceso.
 */
export async function resendInvitation(
  service: SupabaseClient<any>,
  storeId: string,
  inviteId: string,
  origin: string
): Promise<MembersResult> {
  const { data: invite } = await service
    .from('invitations')
    .select('id, email, role, expires_at, stores ( name )')
    .eq('id', inviteId)
    .eq('store_id', storeId)
    .eq('invitation_type', 'store_member')
    .is('accepted_at', null)
    .maybeSingle();
  if (!invite) return falla(404, 'La invitación ya no existe.');

  const actionLink = await generateInviteLink(service, invite.email, `${origin}/accept-invite`);
  if (!actionLink) return falla(500, 'No se pudo generar el enlace de la invitación. Vuelve a intentarlo.');

  const { data: rol } = await service.from('roles').select('label').eq('id', invite.role).maybeSingle();

  try {
    await sendEmail({
      to: invite.email,
      subject: 'Te invitaron a una tienda en MercaMesa',
      html: storeInvitationEmail(
        (invite as any).stores?.name || 'una tienda',
        rol?.label || 'Miembro',
        actionLink,
        INVITATION_DAYS
      ),
    });
  } catch (err) {
    // La vigencia solo se renueva si el correo salió: si no, la invitación
    // seguiría vencida a la vista y se puede reintentar.
    console.error('stores/members: no se pudo enviar el correo', err);
    return falla(502, 'No pudimos enviar la invitación por correo. Intenta de nuevo en unos minutos.');
  }

  const expires = invitationExpiry(new Date());
  const { error: updateError } = await service
    .from('invitations')
    .update({ expires_at: expires.toISOString() })
    .eq('id', invite.id);
  if (updateError) {
    console.error('stores/members: no se pudo renovar la vigencia', updateError);
    return falla(500, 'No se pudo renovar la invitación.');
  }

  return { ok: true, status: 200, body: { resent: true, expiresAt: expires.toISOString() } };
}
