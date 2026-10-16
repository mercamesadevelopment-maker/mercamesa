import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { requirePermission } from '@/lib/auth/require-permission';
import { StaffError, type StaffRole } from '@/lib/marketplace-staff/actor';
import { cancelMarketplaceStaffInvitation, inviteMarketplaceStaff } from '@/lib/marketplace-staff/admin';

/**
 * Invitar a alguien al equipo de una plaza (patinador o logística). Mismo flujo
 * que la invitación de administradores (`app/api/admin/users/invite`): solo pide
 * correo y rol; el invitado completa sus datos al aceptar.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const denied = await requirePermission(
      supabase,
      'marketplace',
      'update',
      'No tienes permisos para invitar al equipo de la plaza'
    );
    if (denied) return denied;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const service = createSupabaseServiceClient() as unknown as SupabaseClient<any>;

    const result = await inviteMarketplaceStaff(service, {
      marketplaceId: id,
      email: String(body.email ?? ''),
      role: body.role as StaffRole,
      actorId: user.id,
      origin: request.headers.get('origin') || new URL(request.url).origin,
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof StaffError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[admin/marketplaces/staff/invite]', error);
    return NextResponse.json({ error: 'No se pudo crear la invitación.' }, { status: 500 });
  }
}

/** Cancela una invitación pendiente de la plaza. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const denied = await requirePermission(supabase, 'marketplace', 'update');
    if (denied) return denied;

    const { id } = await params;
    const inviteId = new URL(request.url).searchParams.get('inviteId');
    if (!inviteId) return NextResponse.json({ error: 'Falta la invitación a cancelar.' }, { status: 400 });

    const service = createSupabaseServiceClient() as unknown as SupabaseClient<any>;
    await cancelMarketplaceStaffInvitation(service, id, inviteId);
    return NextResponse.json({ cancelled: true }, { status: 200 });
  } catch (error: unknown) {
    console.error('[admin/marketplaces/staff/invite] cancelar', error);
    return NextResponse.json({ error: 'No se pudo cancelar la invitación.' }, { status: 500 });
  }
}
