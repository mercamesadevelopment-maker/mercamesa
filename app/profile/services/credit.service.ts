import type { BuyerCredit } from '@/lib/pqrs/refunds';

export async function fetchBuyerCredit(): Promise<BuyerCredit> {
  const res = await fetch('/api/profile/credit');
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? 'No pudimos cargar tu saldo.');
  return json.data as BuyerCredit;
}
