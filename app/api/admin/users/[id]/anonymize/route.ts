import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { requirePermission } from '@/lib/auth/require-permission';
import { getClientIp } from '@/lib/auth/verification-codes';

/**
 * Atiende una solicitud de supresión de datos personales.
 *
 * No borra la fila de `profiles`: 26 claves foráneas apuntan a ella y el borrado
 * revienta en cuanto la persona haya comprado. Además, lo que sí se borraría en
 * cascada —`legal_acceptances`— es precisamente la prueba de que aceptó los
 * términos, que es lo que hace falta si esa persona reclama después.
 *
 * Lo que hace: suprime los datos personales de las diez tablas donde están
 * (la función `anonymize_buyer` lo hace en una sola transacción), borra el
 * avatar y deja la cuenta de acceso vacía y bloqueada. El pedido y la factura se
 * conservan porque hay deber legal de conservarlos.
 */

/** Un pedido en estos estados ya terminó su ciclo. */
const ESTADOS_TERMINADOS = ['delivered', 'cancelled', 'returned'];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // `delete` y no `update`: esto suprime datos y no tiene vuelta atrás. Solo
    // el superadmin tiene esa acción sobre el módulo de usuarios.
    const denied = await requirePermission(
      supabase,
      'users',
      'delete',
      'No tienes permisos para suprimir los datos de un usuario'
    );
    if (denied) return denied;

    const { data: { user: actor } } = await supabase.auth.getUser();
    if (!actor) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const service = createSupabaseServiceClient();

    const { data: objetivo } = await service
      .from('profiles')
      .select('id, email, anonymized_at, roles ( name )')
      .eq('id', id)
      .maybeSingle();

    if (!objetivo) {
      return NextResponse.json({ error: 'El usuario no existe.' }, { status: 404 });
    }

    if (objetivo.anonymized_at) {
      return NextResponse.json(
        { error: 'Los datos de este usuario ya fueron suprimidos.' },
        { status: 400 }
      );
    }

    // Un superadmin anonimizándose a sí mismo (o a otro) dejaría la plataforma
    // sin quién la administre, y sin forma de deshacerlo.
    if ((objetivo.roles as any)?.name === 'superadmin') {
      return NextResponse.json(
        { error: 'No se pueden suprimir los datos de un super administrador.' },
        { status: 400 }
      );
    }

    // Pedidos en curso: el operador logístico exige nombre y teléfono para
    // despachar, así que borrarlos ahora deja el pedido imposible de entregar y
    // al tendero sin a quién llamar.
    const { data: enCurso } = await service
      .from('orders')
      .select('id, status, payment_status')
      .eq('buyer_id', id);

    const pendientes = (enCurso ?? []).filter(
      (o) => !ESTADOS_TERMINADOS.includes(o.status) || o.payment_status === 'processing'
    );

    if (pendientes.length > 0) {
      return NextResponse.json(
        {
          error:
            `Este usuario tiene ${pendientes.length} pedido(s) sin terminar. ` +
            'No se pueden suprimir sus datos todavía: el operador logístico necesita ' +
            'su nombre y teléfono para entregar. Inténtalo cuando se hayan entregado o cancelado.',
        },
        { status: 409 }
      );
    }

    // El avatar, antes de perder la ruta: el `update` de abajo la pone en nulo.
    const { data: conAvatar } = await service
      .from('profiles')
      .select('avatar_url')
      .eq('id', id)
      .single();

    const { error: rpcError } = await service.rpc('anonymize_buyer', { target: id });

    if (rpcError) {
      console.error('anonymize: la función falló', rpcError);
      return NextResponse.json(
        { error: 'No se pudieron suprimir los datos. No se modificó nada.' },
        { status: 500 }
      );
    }

    if (conAvatar?.avatar_url) {
      const { error: storageError } = await service.storage
        .from('avatars')
        .remove([conAvatar.avatar_url]);
      // El perfil ya quedó anónimo; un avatar que no se pudo borrar se registra
      // para limpiarlo a mano, no invalida la supresión.
      if (storageError) {
        console.error('anonymize: no se pudo borrar el avatar', storageError.message);
      }
    }

    // Al final, y no antes: si algo de lo anterior hubiera fallado, la cuenta
    // sigue intacta y se puede reintentar.
    //
    // Se VACÍA en vez de borrarse. `profiles.id` referencia a `auth.users` EN
    // CASCADA, así que borrar la cuenta arrastraría el perfil — y los pedidos lo
    // impiden (`orders.buyer_id` es NO ACTION), de modo que el borrado falla
    // entero. La alternativa era quitar esa clave foránea, y eso permitiría
    // perfiles sin cuenta en todo el sistema para siempre, no solo acá.
    //
    // El resultado para la persona es el mismo: no queda ningún dato suyo, no
    // puede entrar, y su correo real queda libre por si quiere registrarse de
    // cero.
    const { error: authError } = await service.auth.admin.updateUserById(id, {
      email: `eliminado+${id}@mercamesa.invalid`,
      phone: undefined,
      password: crypto.randomUUID() + crypto.randomUUID(),
      user_metadata: {},
      app_metadata: {},
      ban_duration: '876000h', // cien años: la API no acepta "para siempre".
    });

    if (authError) {
      console.error('anonymize: no se pudo vaciar la cuenta de acceso', authError.message);
      return NextResponse.json(
        {
          error:
            'Los datos se suprimieron, pero la cuenta de acceso no se pudo vaciar. ' +
            'Vuelve a intentarlo.',
        },
        { status: 500 }
      );
    }

    await service.from('admin_user_actions').insert({
      actor_id: actor.id,
      target_user_id: id,
      action: 'data_anonymized',
      request_ip: getClientIp(request),
    });

    return NextResponse.json({ anonymized: true }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
