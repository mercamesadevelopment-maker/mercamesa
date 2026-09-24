export interface StoreProfile {
  id: string;
  name: string;
  description: string | null;
  local_address: string | null;
  /** Dirección de recogida propia. Vacía: se recoge en la plaza. */
  address: string | null;
  city: string | null;
  department: string | null;
  latitude: number | null;
  longitude: number | null;
  contact_name: string | null;
  contact_email: string | null;
  phone: string | null;
  whatsapp: string | null;
  /** Las categorías de la tienda, ya aplanadas por la ruta. Son varias. */
  categories: StoreCategory[];
  is_wholesale: boolean;
  is_retail: boolean;
  logo_url: string | null;
  cover_image_url: string | null;
  logoSignedUrl: string | null;
  coverSignedUrl: string | null;
  marketplaces?: { name: string } | null;
}

export interface StoreCategory {
  id: string;
  name: string;
}

async function handle<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Request failed');
  return json.data as T;
}

export const storeProfileService = {
  async getStore(storeId: string): Promise<StoreProfile> {
    return handle<StoreProfile>(await fetch(`/api/stores/${storeId}`));
  },

  async getCategories(): Promise<StoreCategory[]> {
    return handle<StoreCategory[]>(await fetch('/api/store-categories'));
  },

  async updateStore(storeId: string, payload: Record<string, unknown>): Promise<StoreProfile> {
    return handle<StoreProfile>(
      await fetch(`/api/stores/${storeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    );
  },
};
