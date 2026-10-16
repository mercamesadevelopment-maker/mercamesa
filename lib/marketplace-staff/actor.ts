import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * El equipo de una plaza: patinadores y logística.
 *
 * El rol de la cuenta dice QUÉ hace la persona; `marketplace_staff` dice en QUÉ
 * plazas. Esa tabla no tiene políticas: solo la lee el servidor, y la regla de
 * quién ve qué pedido vive acá. Todas las rutas de `app/api/runner` y
 * `app/api/logistics` pasan por `loadStaffActor`.
 */

export const STAFF_ROLES = ['runner', 'logistics'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const STAFF_ROLE_LABEL: Record<StaffRole, string> = {
  runner: 'Patinador',
  logistics: 'Logística',
};

/** Un motivo esperable para no seguir, con su código HTTP. */
export class StaffError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'StaffError';
    this.status = status;
  }
}

export interface StaffActor {
  userId: string;
  /** Un administrador ve y opera los pedidos de todas las plazas. */
  isAdmin: boolean;
  /** `null` para un administrador. */
  role: StaffRole | null;
  /** Plazas que atiende. Vacío para un administrador. */
  marketplaceIds: string[];
}

/**
 * Quién pregunta, si es alguien de `allowed` o un administrador.
 *
 * Una persona sin plazas asignadas no es un error: simplemente no ve pedidos.
 */
export async function loadStaffActor(
  service: SupabaseClient<any>,
  userId: string,
  allowed: readonly StaffRole[]
): Promise<StaffActor> {
  const { data: perfil } = await service
    .from('profiles')
    .select('is_active, roles ( name )')
    .eq('id', userId)
    .maybeSingle();

  // El proxy ya saca de las páginas a una cuenta inactiva, pero las rutas de
  // `app/api` no pasan por él.
  if (!perfil || (perfil as any).is_active === false) {
    throw new StaffError('Tu cuenta no está activa.', 403);
  }

  const rol = (perfil as any)?.roles?.name;
  if (rol === 'admin' || rol === 'superadmin') {
    return { userId, isAdmin: true, role: null, marketplaceIds: [] };
  }

  if (!allowed.includes(rol)) {
    throw new StaffError('No tienes acceso a estos pedidos.', 403);
  }

  const { data: plazas } = await service
    .from('marketplace_staff')
    .select('marketplace_id')
    .eq('user_id', userId)
    .eq('role', rol)
    .eq('is_active', true);

  return {
    userId,
    isAdmin: false,
    role: rol as StaffRole,
    marketplaceIds: (plazas ?? []).map((p: any) => p.marketplace_id),
  };
}

export function canWorkMarketplace(actor: StaffActor, marketplaceId: string | null | undefined): boolean {
  if (actor.isAdmin) return true;
  return Boolean(marketplaceId) && actor.marketplaceIds.includes(String(marketplaceId));
}

/**
 * La plaza de un pedido. Sale de sus tiendas: todas son de la misma, porque
 * solo así se pueden juntar en un pedido.
 */
export async function marketplaceOfOrder(service: SupabaseClient<any>, orderId: string): Promise<string | null> {
  const { data } = await service
    .from('store_orders')
    .select('stores ( marketplace_id )')
    .eq('order_id', orderId)
    .limit(1)
    .maybeSingle();
  return (data as any)?.stores?.marketplace_id ?? null;
}
