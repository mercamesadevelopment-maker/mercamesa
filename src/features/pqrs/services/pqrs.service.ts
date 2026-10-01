import { uploadToSignedUrl } from '@/lib/supabase/client-upload';
import { PQRS_BUCKET } from '@/lib/pqrs/storage';
import type { PqrsPage } from '@/lib/pqrs/queries';
import type {
  NewPqrsInput,
  PqrsDetail,
  PqrsFormContext,
  PqrsStatus,
  PqrsViewer,
} from '@/lib/pqrs/types';

async function handle<T>(res: Response): Promise<T> {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? 'No pudimos completar la operación.');
  return json.data as T;
}

function post<T>(url: string, body: unknown): Promise<T> {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then((res) => handle<T>(res));
}

function query(params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [clave, valor] of Object.entries(params)) {
    if (valor !== null && valor !== undefined && valor !== '') search.set(clave, String(valor));
  }
  return search.toString();
}

export const pqrsService = {
  async list(params: {
    scope: PqrsViewer;
    status?: PqrsStatus | null;
    storeId?: string | null;
    page?: number;
  }): Promise<PqrsPage> {
    const qs = query({ scope: params.scope, status: params.status, store_id: params.storeId, page: params.page });
    return handle<PqrsPage>(await fetch(`/api/pqrs?${qs}`));
  },

  async formContext(params: {
    as: 'buyer' | 'seller';
    storeOrderId?: string | null;
    orderId?: string | null;
    storeId?: string | null;
  }): Promise<PqrsFormContext> {
    const qs = query({
      as: params.as,
      store_order_id: params.storeOrderId,
      order_id: params.orderId,
      store_id: params.storeId,
    });
    return handle<PqrsFormContext>(await fetch(`/api/pqrs/context?${qs}`));
  },

  create(input: NewPqrsInput): Promise<{ id: string; code: string }> {
    return post('/api/pqrs', input);
  },

  async detail(id: string): Promise<PqrsDetail> {
    return handle<PqrsDetail>(await fetch(`/api/pqrs/${id}`));
  },

  sendMessage(
    id: string,
    input: { body: string; isInternal?: boolean; attachments?: string[] }
  ): Promise<PqrsDetail> {
    return post(`/api/pqrs/${id}/messages`, input);
  },

  respondAsStore(id: string, input: { decision: 'accept' | 'reject'; notes: string }): Promise<PqrsDetail> {
    return post(`/api/pqrs/${id}/store-response`, input);
  },

  resolve(
    id: string,
    input: { outcome: string; liable: string | null; notes: string }
  ): Promise<PqrsDetail> {
    return post(`/api/pqrs/${id}/resolve`, input);
  },

  /**
   * Sube las fotos y devuelve sus rutas temporales, que son las que se mandan
   * después al radicar o al escribir.
   */
  async uploadPhotos(files: File[]): Promise<string[]> {
    if (files.length === 0) return [];

    const tickets = await post<{ path: string; token: string }[]>('/api/pqrs/uploads', {
      files: files.map((f) => ({ type: f.type, size: f.size })),
    });

    await Promise.all(
      tickets.map((ticket, i) => uploadToSignedUrl(PQRS_BUCKET, ticket.path, ticket.token, files[i]))
    );

    return tickets.map((t) => t.path);
  },
};
