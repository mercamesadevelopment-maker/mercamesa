/** Las cifras del tablero del comprador. */
export interface BuyerStats {
  /** Pedidos que llegaron a algo: se excluyen los cancelados y devueltos. */
  totalOrders: number;
  /** Los que todavía están en camino. */
  inProgress: number;
  /** `profiles.created_at`, sin formatear. */
  memberSince: string | null;
}

const BASE = '/api/profile/stats';

async function handle<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Request failed');
  return json.data as T;
}

export const buyerStatsService = {
  async get(): Promise<BuyerStats> {
    return handle<BuyerStats>(await fetch(BASE));
  },
};
