import type { PaymentMethodInsert, PaymentMethodRow, PaymentMethodUpdate } from '../types/payment.types';

const BASE = '/api/payments';

async function handle<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Request failed');
  return json.data as T;
}

export const paymentsService = {
  async getAll(): Promise<PaymentMethodRow[]> {
    return handle<PaymentMethodRow[]>(await fetch(BASE));
  },

  async create(payload: PaymentMethodInsert): Promise<PaymentMethodRow> {
    return handle<PaymentMethodRow>(
      await fetch(BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    );
  },

  async update(id: string, payload: PaymentMethodUpdate): Promise<PaymentMethodRow> {
    return handle<PaymentMethodRow>(
      await fetch(`${BASE}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    );
  },

  async remove(id: string): Promise<void> {
    const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error ?? 'Delete failed');
    }
  },
};
