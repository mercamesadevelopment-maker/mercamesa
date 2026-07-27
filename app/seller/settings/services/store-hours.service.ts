import type { BusinessHours } from '@/components/ui/business-hours/business-hours-editor';

async function handle<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Request failed');
  return json.data as T;
}

export const storeHoursService = {
  async getStore(storeId: string): Promise<{ business_hours: BusinessHours | null }> {
    return handle(await fetch(`/api/stores/${storeId}`));
  },

  async updateHours(storeId: string, businessHours: BusinessHours): Promise<{ business_hours: BusinessHours }> {
    return handle(
      await fetch(`/api/stores/${storeId}/hours`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_hours: businessHours }),
      })
    );
  },
};
