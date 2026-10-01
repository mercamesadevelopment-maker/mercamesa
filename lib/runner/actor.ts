import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Quién pregunta, visto desde los pedidos por recoger.
 *
 * `marketplace_runners` no tiene políticas: solo la lee el servidor. La regla de
 * quién ve qué pedido vive acá y todas las rutas de `app/api/runner` pasan por
 * ella.
 */

/** Un motivo esperable para no seguir, con su código HTTP. */
export class RunnerError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'RunnerError';
    this.status = status;
  }
}

export interface RunnerActor {
  userId: string;
  /** Un administrador ve y opera los pedidos de todas las plazas. */
  isAdmin: boolean;
  /** Plazas que atiende. Vacío para un administrador. */
  marketplaceIds: string[];
}

export async function loadRunnerActor(service: SupabaseClient<any>, userId: string): Promise<RunnerActor> {
  const { data: perfil } = await service
    .from('profiles')
    .select('is_active, roles ( name )')
    .eq('id', userId)
    .maybeSingle();

  // El proxy ya saca de las páginas a una cuenta inactiva, pero las rutas de
  // `app/api` no pasan por él.
  if (!perfil || (perfil as any).is_active === false) {
    throw new RunnerError('Tu cuenta no está activa.', 403);
  }

  const rol = (perfil as any)?.roles?.name;
  if (rol === 'admin' || rol === 'superadmin') {
    return { userId, isAdmin: true, marketplaceIds: [] };
  }

  if (rol !== 'runner') {
    throw new RunnerError('Solo un patinador o un administrador puede ver estos pedidos.', 403);
  }

  const { data: plazas } = await service
    .from('marketplace_runners')
    .select('marketplace_id')
    .eq('user_id', userId)
    .eq('is_active', true);

  return { userId, isAdmin: false, marketplaceIds: (plazas ?? []).map((p: any) => p.marketplace_id) };
}

export function canWorkMarketplace(actor: RunnerActor, marketplaceId: string | null | undefined): boolean {
  if (actor.isAdmin) return true;
  return Boolean(marketplaceId) && actor.marketplaceIds.includes(String(marketplaceId));
}
