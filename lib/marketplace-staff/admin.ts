import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail, marketplaceStaffInvitationEmail } from '@/lib/email/resend';
import { STAFF_ROLE_LABEL, STAFF_ROLES, StaffError, type StaffRole } from './actor';

/**
 * Lo que el admin de plataforma configura en una plaza: si usa patinador y
 * logística, la comisión del patinador y quién está en el equipo.
 *
 * Todo con el cliente de servicio: `marketplace_staff` no tiene políticas y
 * `invitations` se escribe desde el servidor. Quien llama ya comprobó el permiso
 * sobre las plazas.
 */

export interface MarketplaceStaffSettings {
  runnerEnabled: boolean;
  logisticsEnabled: boolean;
  commissionType: 'percent' | 'fixed' | null;
  commissionValue: number | null;
}

export interface StaffMember {
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: StaffRole;
  isActive: boolean;
}

export interface StaffInvitation {
  id: string;
  email: string;
  role: StaffRole;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
}

export interface RunnerCommissionSummary {
  userId: string;
  name: string;
  orders: number;
  amount: number;
}

export interface MarketplaceStaffOverview {
  settings: MarketplaceStaffSettings;
  staff: StaffMember[];
  invitations: StaffInvitation[];
  /** Comisiones del mes en curso, por patinador. Informativas. */
  commissions: RunnerCommissionSummary[];
}

const DIAS_VIGENCIA = 7;

async function rolesPorNombre(service: SupabaseClient<any>): Promise<Map<string, { id: string; name: StaffRole }>> {
  const { data } = await service.from('roles').select('id, name').in('name', STAFF_ROLES as unknown as string[]);
  return new Map((data ?? []).map((r: any) => [r.name, r]));
}

/** El primer día del mes en curso, en hora de Colombia. */
function inicioDelMes(): string {
  const ahora = new Date(Date.now() - 5 * 3600_000);
  return new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1, 5)).toISOString();
}

export async function getMarketplaceStaff(
  service: SupabaseClient<any>,
  marketplaceId: string
): Promise<MarketplaceStaffOverview> {
  const { data: plaza, error } = await service
    .from('marketplaces')
    .select('runner_enabled, logistics_enabled, runner_commission_type, runner_commission_value')
    .eq('id', marketplaceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!plaza) throw new StaffError('No encontramos esa plaza.', 404);

  const roles = await rolesPorNombre(service);
  const rolDeId = new Map(Array.from(roles.values()).map((r) => [r.id, r.name]));

  const [{ data: equipo }, { data: invitaciones }, { data: pedidos }] = await Promise.all([
    service
      .from('marketplace_staff')
      .select('user_id, role, is_active, profiles ( full_name, email, phone )')
      .eq('marketplace_id', marketplaceId)
      .order('created_at', { ascending: true }),
    service
      .from('invitations')
      .select('id, email, role, created_at, expires_at')
      .eq('invitation_type', 'marketplace_member')
      .eq('marketplace_id', marketplaceId)
      .is('accepted_at', null)
      .order('created_at', { ascending: false }),
    service
      .from('orders')
      .select('bay_ready_by, runner_commission_amount, store_orders!inner ( stores!inner ( marketplace_id ) )')
      .eq('runner_required', true)
      .eq('store_orders.stores.marketplace_id', marketplaceId)
      .gte('bay_ready_at', inicioDelMes())
      .not('bay_ready_by', 'is', null),
  ]);

  const staff: StaffMember[] = (equipo ?? []).map((m: any) => ({
    userId: m.user_id,
    name: m.profiles?.full_name || m.profiles?.email || 'Sin nombre',
    email: m.profiles?.email ?? null,
    phone: m.profiles?.phone ?? null,
    role: m.role,
    isActive: m.is_active,
  }));

  const nombre = new Map(staff.map((s) => [s.userId, s.name]));
  const porPatinador = new Map<string, RunnerCommissionSummary>();
  for (const p of pedidos ?? []) {
    const id = (p as any).bay_ready_by as string;
    const fila = porPatinador.get(id) ?? { userId: id, name: nombre.get(id) ?? 'Patinador', orders: 0, amount: 0 };
    fila.orders += 1;
    fila.amount += Number((p as any).runner_commission_amount ?? 0);
    porPatinador.set(id, fila);
  }

  return {
    settings: {
      runnerEnabled: plaza.runner_enabled,
      logisticsEnabled: plaza.logistics_enabled,
      commissionType: plaza.runner_commission_type as MarketplaceStaffSettings['commissionType'],
      commissionValue: plaza.runner_commission_value == null ? null : Number(plaza.runner_commission_value),
    },
    staff,
    invitations: (invitaciones ?? [])
      .filter((i: any) => rolDeId.has(i.role))
      .map((i: any) => ({
        id: i.id,
        email: i.email,
        role: rolDeId.get(i.role)!,
        createdAt: i.created_at,
        expiresAt: i.expires_at,
        expired: new Date(i.expires_at) <= new Date(),
      })),
    commissions: Array.from(porPatinador.values()).sort((a, b) => b.amount - a.amount),
  };
}

/** Valida y guarda la configuración de la plaza. Afecta solo a los pedidos nuevos. */
export async function saveMarketplaceStaffSettings(
  service: SupabaseClient<any>,
  marketplaceId: string,
  s: MarketplaceStaffSettings
): Promise<void> {
  let tipo = s.commissionType;
  let valor = s.commissionValue;

  if (!s.runnerEnabled || tipo == null || valor == null) {
    tipo = null;
    valor = null;
  } else {
    if (!['percent', 'fixed'].includes(tipo)) throw new StaffError('El tipo de comisión no es válido.');
    if (!Number.isFinite(valor) || valor < 0) throw new StaffError('La comisión no puede ser negativa.');
    if (tipo === 'percent' && valor > 100) throw new StaffError('El porcentaje no puede pasar de 100.');
  }

  const { error } = await service
    .from('marketplaces')
    .update({
      runner_enabled: s.runnerEnabled,
      logistics_enabled: s.logisticsEnabled,
      runner_commission_type: tipo,
      runner_commission_value: valor,
    })
    .eq('id', marketplaceId);
  if (error) throw new Error(error.message);
}

/** Activa o desactiva a alguien del equipo. No se borra: queda quién atendió. */
export async function setStaffMemberActive(
  service: SupabaseClient<any>,
  marketplaceId: string,
  userId: string,
  role: StaffRole,
  isActive: boolean
): Promise<void> {
  const { error } = await service
    .from('marketplace_staff')
    .update({ is_active: isActive })
    .eq('marketplace_id', marketplaceId)
    .eq('user_id', userId)
    .eq('role', role);
  if (error) throw new Error(error.message);
}

/**
 * Invita a alguien al equipo de la plaza.
 *
 * - Si ya tiene cuenta con ese mismo rol (un patinador que también cubre otra
 *   plaza), se le asigna la plaza sin invitarlo.
 * - Si tiene cuenta con otro rol, no: cambiarle el rol es una decisión aparte.
 * - Si no tiene cuenta, se le manda el enlace para crearla; al aceptarlo queda
 *   asignado a la plaza (`app/api/auth/accept-invite`).
 */
export async function inviteMarketplaceStaff(
  service: SupabaseClient<any>,
  params: { marketplaceId: string; email: string; role: StaffRole; actorId: string; origin: string }
): Promise<{ assigned: boolean; invited: boolean }> {
  const email = params.email.trim().toLowerCase();
  if (!email.includes('@')) throw new StaffError('Escribe un correo válido.');
  if (!STAFF_ROLES.includes(params.role)) throw new StaffError('Solo puedes invitar patinadores o logística.');

  const { data: plaza } = await service.from('marketplaces').select('id, name').eq('id', params.marketplaceId).maybeSingle();
  if (!plaza) throw new StaffError('No encontramos esa plaza.', 404);

  const rol = (await rolesPorNombre(service)).get(params.role);
  if (!rol) throw new StaffError('El rol no existe.');

  const { data: cuenta } = await service
    .from('profiles')
    .select('id, roles ( name )')
    .eq('email', email)
    .maybeSingle();

  if (cuenta) {
    if ((cuenta as any).roles?.name !== params.role) {
      throw new StaffError(
        `Ese correo ya tiene una cuenta en MercaMesa con otro rol. Solo se puede sumar a la plaza a quien ya es ${STAFF_ROLE_LABEL[params.role]}.`
      );
    }
    const { error } = await service.from('marketplace_staff').upsert(
      {
        marketplace_id: params.marketplaceId,
        user_id: cuenta.id,
        role: params.role,
        is_active: true,
        created_by: params.actorId,
      },
      { onConflict: 'marketplace_id,user_id,role' }
    );
    if (error) throw new Error(error.message);
    return { assigned: true, invited: false };
  }

  const { data: pendiente } = await service
    .from('invitations')
    .select('id')
    .eq('email', email)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (pendiente) {
    throw new StaffError('Ese correo ya tiene una invitación pendiente. Cancélala antes de volver a invitar.');
  }

  // `generateLink` produce el enlace sin enviar correo, para mandarlo con la
  // plantilla de la plataforma.
  const { data: link, error: linkError } = await service.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { redirectTo: `${params.origin}/accept-invite` },
  });
  if (linkError || !link?.properties?.action_link) {
    console.error('marketplace-staff: no se pudo generar el enlace', linkError);
    throw new StaffError('No se pudo crear la invitación. Vuelve a intentarlo.', 500);
  }

  const expires = new Date();
  expires.setDate(expires.getDate() + DIAS_VIGENCIA);

  // La fila va ANTES del correo, como en la invitación de administradores:
  // `generateLink` ya creó la cuenta en `auth.users`, y sin invitación que la
  // respalde quedaría imposible de completar.
  const { data: invitacion, error: dbError } = await service
    .from('invitations')
    .insert({
      email,
      role: rol.id,
      invitation_type: 'marketplace_member',
      marketplace_id: params.marketplaceId,
      invited_by: params.actorId,
      token: crypto.randomUUID(),
      expires_at: expires.toISOString(),
    })
    .select('id')
    .single();
  if (dbError) {
    console.error('marketplace-staff: no se pudo registrar la invitación', dbError);
    throw new StaffError('No se pudo crear la invitación. Vuelve a intentarlo.', 500);
  }

  const { data: actor } = await service.from('profiles').select('full_name').eq('id', params.actorId).maybeSingle();

  try {
    await sendEmail({
      to: email,
      subject: `Te invitaron a ${plaza.name} en MercaMesa`,
      html: marketplaceStaffInvitationEmail(
        actor?.full_name || 'Un administrador',
        plaza.name,
        STAFF_ROLE_LABEL[params.role],
        link.properties.action_link,
        DIAS_VIGENCIA
      ),
    });
  } catch (err) {
    // Sin correo nadie tiene el enlace: se deshace para poder reintentar.
    console.error('marketplace-staff: no se pudo enviar el correo', err);
    await service.from('invitations').delete().eq('id', invitacion.id);
    throw new StaffError('No pudimos enviar la invitación por correo. Intenta de nuevo en unos minutos.', 502);
  }

  return { assigned: false, invited: true };
}

/** Cancela una invitación pendiente de esta plaza. */
export async function cancelMarketplaceStaffInvitation(
  service: SupabaseClient<any>,
  marketplaceId: string,
  inviteId: string
): Promise<void> {
  // El filtro por tipo y plaza evita que esta ruta borre invitaciones ajenas.
  const { error } = await service
    .from('invitations')
    .delete()
    .eq('id', inviteId)
    .eq('invitation_type', 'marketplace_member')
    .eq('marketplace_id', marketplaceId);
  if (error) throw new Error(error.message);
}
