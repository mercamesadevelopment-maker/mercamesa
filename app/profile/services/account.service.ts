import type { AccountProfile } from '../types/account.types';

const BASE = '/api/profile';

async function handle<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Request failed');
  return json.data as T;
}

export const accountService = {
  async getProfile(): Promise<AccountProfile> {
    return handle<AccountProfile>(await fetch(BASE));
  },

  async updateProfile(formData: FormData): Promise<AccountProfile> {
    return handle<AccountProfile>(
      await fetch(BASE, {
        method: 'PUT',
        body: formData,
      })
    );
  },
};
