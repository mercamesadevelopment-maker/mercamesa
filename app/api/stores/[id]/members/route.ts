import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { requirePermission } from '@/lib/auth/require-permission';
import { canManageStore } from '@/lib/auth/can-manage-store';
import {
  addMember,
  listMembers,
  removeMemberOrInvitation,
  resendInvitation,
  type MembersResult,
} from '@/lib/stores/members';

type Params = { params: Promise<{ id: string }> };

const responder = (result: MembersResult) =>
  'message' in result
    ? NextResponse.json({ error: result.message }, { status: result.status })
    : NextResponse.json(result.body, { status: result.status });

const errorInterno = (error: unknown) =>
  NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });

/** El origen de la app, para los enlaces de los correos. */
const origenDe = (request: Request) => request.headers.get('origin') || new URL(request.url).origin;

/**
 * Sesión y permiso sobre la tienda. El equipo y las invitaciones de una tienda
 * son de su gente (o de un admin): antes bastaba con tener sesión para ver,
 * invitar o sacar a cualquiera.
 */
async function gestor(storeId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { denied: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!(await canManageStore(supabase, storeId, user.id))) {
    return { denied: NextResponse.json({ error: 'No tienes permisos sobre esta tienda.' }, { status: 403 }) };
  }
  return { supabase, user };
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const auth = await gestor(id);
    if ('denied' in auth) return auth.denied;
    return responder(await listMembers(auth.supabase, createSupabaseServiceClient(), id));
  } catch (error: unknown) {
    return errorInterno(error);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const auth = await gestor(id);
    if ('denied' in auth) return auth.denied;

    const { email, role_id } = await request.json();
    if (!email || !role_id) {
      return NextResponse.json({ error: 'Email y Rol son requeridos.' }, { status: 400 });
    }

    return responder(
      await addMember(auth.supabase, createSupabaseServiceClient(), {
        storeId: id,
        email,
        roleId: role_id,
        invitedBy: auth.user.id,
        origin: origenDe(request),
      })
    );
  } catch (error: unknown) {
    return errorInterno(error);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const auth = await gestor(id);
    if ('denied' in auth) return auth.denied;

    const { searchParams } = new URL(request.url);
    return responder(
      await removeMemberOrInvitation(auth.supabase, createSupabaseServiceClient(), id, {
        memberId: searchParams.get('memberId'),
        inviteId: searchParams.get('inviteId'),
      })
    );
  } catch (error: unknown) {
    return errorInterno(error);
  }
}

/** Reenvía una invitación: renueva la vigencia y manda un enlace nuevo. */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Usa el cliente de servicio, que se salta RLS: el permiso se exige acá.
    const denied = await requirePermission(supabase, 'stores', 'update', 'No tienes permisos para reenviar invitaciones');
    if (denied) return denied;

    const inviteId = new URL(request.url).searchParams.get('inviteId');
    if (!inviteId) {
      return NextResponse.json({ error: 'Falta la invitación a reenviar.' }, { status: 400 });
    }

    return responder(await resendInvitation(createSupabaseServiceClient(), id, inviteId, origenDe(request)));
  } catch (error: unknown) {
    return errorInterno(error);
  }
}
