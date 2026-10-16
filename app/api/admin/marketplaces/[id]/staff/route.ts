import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { requirePermission } from '@/lib/auth/require-permission';
import { STAFF_ROLES, StaffError, type StaffRole } from '@/lib/marketplace-staff/actor';
import {
  getMarketplaceStaff,
  saveMarketplaceStaffSettings,
  setStaffMemberActive,
} from '@/lib/marketplace-staff/admin';

/**
 * El equipo de una plaza (patinadores y logística) y cómo opera: si usa
 * patinador, si tiene logística y la comisión del patinador.
 *
 * `marketplace_staff` no tiene políticas: se lee y escribe con el cliente de
 * servicio después de comprobar el permiso sobre las plazas.
 */

function responderError(error: unknown, porDefecto: string) {
  if (error instanceof StaffError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error('[admin/marketplaces/staff]', error);
  return NextResponse.json({ error: porDefecto }, { status: 500 });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const denied = await requirePermission(supabase, 'marketplace', 'read');
    if (denied) return denied;

    const { id } = await params;
    const service = createSupabaseServiceClient() as unknown as SupabaseClient<any>;
    return NextResponse.json({ data: await getMarketplaceStaff(service, id) }, { status: 200 });
  } catch (error: unknown) {
    return responderError(error, 'Error cargando el equipo de la plaza');
  }
}

/**
 * Cambia la configuración (`settings`) o activa/desactiva a alguien del equipo
 * (`member`). Devuelve el equipo como quedó.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const denied = await requirePermission(supabase, 'marketplace', 'update');
    if (denied) return denied;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const service = createSupabaseServiceClient() as unknown as SupabaseClient<any>;

    if (body.settings) {
      const s = body.settings;
      await saveMarketplaceStaffSettings(service, id, {
        runnerEnabled: Boolean(s.runnerEnabled),
        logisticsEnabled: Boolean(s.logisticsEnabled),
        commissionType: s.commissionType === 'percent' || s.commissionType === 'fixed' ? s.commissionType : null,
        commissionValue: s.commissionValue === null || s.commissionValue === '' ? null : Number(s.commissionValue),
      });
    }

    if (body.member) {
      const role = body.member.role as StaffRole;
      if (!STAFF_ROLES.includes(role) || !body.member.userId) {
        return NextResponse.json({ error: 'Falta a quién cambiar.' }, { status: 400 });
      }
      await setStaffMemberActive(service, id, String(body.member.userId), role, Boolean(body.member.isActive));
    }

    return NextResponse.json({ data: await getMarketplaceStaff(service, id) }, { status: 200 });
  } catch (error: unknown) {
    return responderError(error, 'Error guardando el equipo de la plaza');
  }
}
