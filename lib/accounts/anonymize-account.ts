import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { storesLeftWithoutOwner } from './inactivity';

/**
 * Suprime los datos personales de una cuenta y la deja inservible.
 *
 * La usan la supresión a pedido (Usuarios → «Suprimir datos») y el cierre por
 * inactividad. No borra la fila de `profiles`: 26 claves foráneas apuntan a ella
 * y el borrado revienta en cuanto la persona haya comprado. Además, lo que sí se
 * borraría en cascada —`legal_acceptances`— es precisamente la prueba de que
 * aceptó los términos. El pedido y la factura se conservan porque hay deber
 * legal de conservarlos.
 *
 * Si es tendero, además sale de sus tiendas, y la tienda que se queda sin dueño
 * pasa a inactiva: no se borra, porque sus pedidos, facturas, documentos y
 * dispersiones se conservan.
 */

/** Un pedido en estos estados ya terminó su ciclo. */
const ESTADOS_TERMINADOS = ['delivered', 'cancelled', 'returned'];

export type AnonymizeResult =
  | { ok: true; deactivatedStores: string[] }
  | { ok: false; status: number; message: string };

const falla = (status: number, message: string): AnonymizeResult => ({ ok: false, status, message });

export async function anonymizeAccount(service: SupabaseClient<any>, userId: string): Promise<AnonymizeResult> {
  const { data: objetivo } = await service
    .from('profiles')
    .select('id, anonymized_at, avatar_url, roles ( name )')
    .eq('id', userId)
    .maybeSingle();

  if (!objetivo) return falla(404, 'El usuario no existe.');
  if (objetivo.anonymized_at) return falla(400, 'Los datos de este usuario ya fueron suprimidos.');

  // Un superadmin anonimizándose a sí mismo (o a otro) dejaría la plataforma
  // sin quién la administre, y sin forma de deshacerlo.
  if ((objetivo.roles as any)?.name === 'superadmin') {
    return falla(400, 'No se pueden suprimir los datos de un super administrador.');
  }

  // Pedidos en curso: el operador logístico exige nombre y teléfono para
  // despachar, así que borrarlos ahora deja el pedido imposible de entregar y
  // al tendero sin a quién llamar.
  const { data: comoComprador } = await service
    .from('orders')
    .select('id, status, payment_status')
    .eq('buyer_id', userId);

  const pendientes = (comoComprador ?? []).filter(
    (o) => !ESTADOS_TERMINADOS.includes(o.status) || o.payment_status === 'processing'
  );
  if (pendientes.length > 0) {
    return falla(
      409,
      `Este usuario tiene ${pendientes.length} pedido(s) sin terminar. ` +
        'No se pueden suprimir sus datos todavía: el operador logístico necesita ' +
        'su nombre y teléfono para entregar. Inténtalo cuando se hayan entregado o cancelado.'
    );
  }

  // Las tiendas que se quedarían sin dueño. Si alguna tiene pedidos en curso,
  // dejarla inactiva los dejaría sin quién los despache.
  const sinDueno = await tiendasQueQuedanSinDueno(service, userId);
  if (sinDueno.length > 0) {
    const { data: activos } = await service
      .from('store_orders')
      .select('id')
      .in('store_id', sinDueno)
      .not('status', 'in', `(${ESTADOS_TERMINADOS.join(',')})`)
      .limit(1);
    if ((activos ?? []).length > 0) {
      return falla(
        409,
        'Es el único dueño de una tienda que tiene pedidos sin terminar. ' +
          'Inténtalo cuando se hayan entregado o cancelado.'
      );
    }
  }

  const { error: rpcError } = await service.rpc('anonymize_buyer', { target: userId });
  if (rpcError) {
    console.error('anonymize: la función falló', rpcError);
    return falla(500, 'No se pudieron suprimir los datos. No se modificó nada.');
  }

  if (objetivo.avatar_url) {
    const { error: storageError } = await service.storage.from('avatars').remove([objetivo.avatar_url]);
    // El perfil ya quedó anónimo; un avatar que no se pudo borrar se registra
    // para limpiarlo a mano, no invalida la supresión.
    if (storageError) console.error('anonymize: no se pudo borrar el avatar', storageError.message);
  }

  if (sinDueno.length > 0) {
    const { error } = await service.from('stores').update({ is_active: false }).in('id', sinDueno);
    if (error) console.error('anonymize: no se pudieron desactivar las tiendas', error.message);
  }
  const { error: salidaError } = await service.from('store_members').delete().eq('user_id', userId);
  if (salidaError) console.error('anonymize: no se pudo sacar de sus tiendas', salidaError.message);

  // Al final, y no antes: si algo de lo anterior hubiera fallado, la cuenta
  // sigue intacta y se puede reintentar.
  //
  // Se VACÍA en vez de borrarse. `profiles.id` referencia a `auth.users` EN
  // CASCADA, así que borrar la cuenta arrastraría el perfil — y los pedidos lo
  // impiden (`orders.buyer_id` es NO ACTION), de modo que el borrado falla
  // entero. El resultado para la persona es el mismo: no queda ningún dato suyo,
  // no puede entrar, y su correo real queda libre por si quiere registrarse de
  // cero.
  const { error: authError } = await service.auth.admin.updateUserById(userId, {
    email: `eliminado+${userId}@mercamesa.invalid`,
    phone: undefined,
    password: crypto.randomUUID() + crypto.randomUUID(),
    user_metadata: {},
    app_metadata: {},
    ban_duration: '876000h', // cien años: la API no acepta "para siempre".
  });

  if (authError) {
    console.error('anonymize: no se pudo vaciar la cuenta de acceso', authError.message);
    return falla(500, 'Los datos se suprimieron, pero la cuenta de acceso no se pudo vaciar. Vuelve a intentarlo.');
  }

  return { ok: true, deactivatedStores: sinDueno };
}

async function tiendasQueQuedanSinDueno(service: SupabaseClient<any>, userId: string): Promise<string[]> {
  const { data: propias } = await service.from('store_members').select('store_id').eq('user_id', userId);
  const storeIds = [...new Set((propias ?? []).map((m) => m.store_id as string))];
  if (storeIds.length === 0) return [];

  const { data: miembros } = await service
    .from('store_members')
    .select('store_id, user_id, roles ( name )')
    .in('store_id', storeIds);

  return storesLeftWithoutOwner(
    (miembros ?? []).map((m: any) => ({
      storeId: m.store_id,
      userId: m.user_id,
      isOwner: m.roles?.name === 'store_owner',
    })),
    userId
  );
}
