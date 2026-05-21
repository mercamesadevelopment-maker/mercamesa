import type { AddressFormValues, DeliveryAddress } from '../types/address.types';

const BASE = '/api/addresses';

async function handle<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Request failed');
  return json.data as T;
}

export const addressesService = {
  async getAll(): Promise<DeliveryAddress[]> {
    return handle<DeliveryAddress[]>(await fetch(BASE));
  },

  async create(payload: AddressFormValues): Promise<DeliveryAddress> {
    return handle<DeliveryAddress>(
      await fetch(BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    );
  },

  async update(id: string, payload: Partial<AddressFormValues>): Promise<DeliveryAddress> {
    return handle<DeliveryAddress>(
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
