import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { requirePermission } from '@/lib/auth/require-permission';
import { getClientIp } from '@/lib/auth/verification-codes';
import {
  PERIODOS,
  calcularVencimiento,
  type PeriodoInactivacion,
} from '@/lib/auth/deactivation';

/**
 * Inactiva una cuenta por un periodo, dejando constancia de quién y por qué.
 *
 * Se exige `users:delete` y no `users:update`, que es la acción de las otras dos
 * operaciones de esta carpeta. La razón: `delete` hoy la tiene únicamente el
 * superadmin, y quitarle el acceso a alguien tiene que seguir siendo suyo
 * aunque algún día el rol `admin` recupere el módulo de usuarios.
 */

const MAX_MOTIVO = 500;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const denied = await requirePermission(
      supabase,
      'users',
      'delete',
      'No tienes permisos para inactivar usuarios'
    );
    if (denied) return denied;

    const { data: { user: actor } } = await supabase.auth.getUser();
    if (!actor) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const reason = String(body.reason ?? '').trim();
    const period = body.period as PeriodoInactivacion;

    // El motivo es obligatorio: sin él la tabla guarda quién y cuándo, que es la
    // mitad inútil del registro. La pregunta que se le hace después a esta fila
    // siempre es "¿por qué?".
    if (!reason) {
      return NextResponse.json(
        { error: 'Escribe el motivo de la inactivación.' },
        { status: 400 }
      );
    }

    if (reason.length > MAX_MOTIVO) {
      return NextResponse.json(
        { error: `El motivo no puede pasar de ${MAX_MOTIVO} caracteres.` },
        { status: 400 }
      );
    }

    if (!PERIODOS.includes(period)) {
      return NextResponse.json(
        { error: 'Selecciona por cuánto tiempo estará inactiva la cuenta.' },
        { status: 400 }
      );
    }

    // Inactivarse a sí mismo deja la plataforma sin quién la administre y sin
    // forma de deshacerlo, porque reactivar exige entrar.
    if (id === actor.id) {
      return NextResponse.json(
        { error: 'No puedes inactivar tu propia cuenta.' },
        { status: 400 }
      );
    }

    const service = createSupabaseServiceClient();

    const { data: objetivo } = await service
      .from('profiles')
      .select('id, is_active, anonymized_at, roles ( name )')
      .eq('id', id)
      .maybeSingle();

    if (!objetivo) {
      return NextResponse.json({ error: 'El usuario no existe.' }, { status: 404 });
    }

    if ((objetivo.roles as any)?.name === 'superadmin') {
      return NextResponse.json(
        { error: 'No se puede inactivar a un super administrador.' },
        { status: 400 }
      );
    }

    if (objetivo.anonymized_at) {
      return NextResponse.json(
        { error: 'Los datos de este usuario ya fueron suprimidos; su cuenta ya no tiene acceso.' },
        { status: 400 }
      );
    }

    if (objetivo.is_active === false) {
      return NextResponse.json(
        { error: 'Esta cuenta ya está inactiva.' },
        { status: 400 }
      );
    }

    const until = calcularVencimiento(period);

    // El historial primero: si algo falla después, queda la constancia de que se
    // intentó y la cuenta sigue funcionando — al revés quedaría una cuenta
    // bloqueada sin nadie que responda por ello.
    const { error: historialError } = await service.from('user_deactivations').insert({
      user_id: id,
      actor_id: actor.id,
      reason,
      period,
      until,
    });

    if (historialError) {
      console.error('deactivate: no se pudo registrar la inactivación', historialError);
      return NextResponse.json(
        { error: 'No se pudo inactivar la cuenta. No se modificó nada.' },
        { status: 500 }
      );
    }

    const { error: perfilError } = await service
      .from('profiles')
      .update({ is_active: false })
      .eq('id', id);

    if (perfilError) {
      console.error('deactivate: no se pudo marcar el perfil', perfilError);
      return NextResponse.json(
        { error: 'No se pudo inactivar la cuenta. Vuelve a intentarlo.' },
        { status: 500 }
      );
    }

    // Sin esto la persona sigue adentro: `is_active` solo se mira al ingresar.
    // Es la misma función que usa la acción de "cerrar sesiones".
    const { error: sesionesError } = await supabase.rpc('admin_revoke_user_sessions', {
      p_user_id: id,
    });

    // La cuenta ya quedó inactiva; que no se hayan podido cerrar las sesiones no
    // invalida la acción, pero sí hay que saberlo: el acceso ya emitido puede
    // durar hasta una hora más. `proxy.ts` lo ataja igual en cada navegación.
    if (sesionesError) {
      console.error('deactivate: no se pudieron cerrar las sesiones', sesionesError.message);
    }

    await service.from('admin_user_actions').insert({
      actor_id: actor.id,
      target_user_id: id,
      action: 'user_deactivated',
      request_ip: getClientIp(request),
    });

    return NextResponse.json({ deactivated: true, until }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
