import type { SupabaseClient } from '@supabase/supabase-js';
import { getPqrsReason } from './reasons';
import { PqrsInputError } from './errors';
import type { PqrsViewer } from './types';

/**
 * Quién pregunta, visto desde las PQRS.
 *
 * Las tablas de PQRS no tienen políticas: solo las lee el servidor. Así que la
 * regla de quién ve qué vive acá, en un solo sitio, y todas las rutas pasan por
 * ella.
 */
export interface PqrsActor {
  userId: string;
  isAdmin: boolean;
  /** Tiendas de las que es miembro. Vacío para un comprador. */
  storeIds: string[];
}

export async function loadPqrsActor(service: SupabaseClient<any>, userId: string): Promise<PqrsActor> {
  const [{ data: perfil }, { data: membresias }] = await Promise.all([
    service.from('profiles').select('is_active, roles ( name )').eq('id', userId).maybeSingle(),
    service.from('store_members').select('store_id').eq('user_id', userId),
  ]);

  // El proxy ya saca de las páginas a una cuenta inactiva, pero las rutas de
  // `app/api` no pasan por él.
  if (!perfil || (perfil as any).is_active === false) {
    throw new PqrsInputError('Tu cuenta no está activa.', 403);
  }

  const rol = (perfil as any)?.roles?.name;

  return {
    userId,
    isAdmin: rol === 'admin' || rol === 'superadmin',
    storeIds: (membresias ?? []).map((m: any) => m.store_id),
  };
}

interface PqrsAccessRow {
  opened_by: string;
  opened_as: string;
  store_id: string | null;
  reason: string;
}

/**
 * Desde qué puesto ve este caso quien pregunta, o `null` si no lo puede ver.
 *
 * - Quien lo abrió lo ve siempre.
 * - La tienda ve los que abrió su propio equipo y, de los del comprador, solo
 *   los motivos que le competen: una queja por mala atención la revisa
 *   MercaMesa sin que la tienda la lea.
 * - El admin ve todo.
 */
export function viewerOf(actor: PqrsActor, pqrs: PqrsAccessRow): PqrsViewer | null {
  if (actor.isAdmin) return 'admin';

  if (pqrs.opened_by === actor.userId) return pqrs.opened_as === 'seller' ? 'seller' : 'buyer';

  if (pqrs.store_id && actor.storeIds.includes(pqrs.store_id)) {
    if (pqrs.opened_as === 'seller') return 'seller';
    if (getPqrsReason(pqrs.reason)?.storeSees) return 'seller';
  }

  return null;
}
