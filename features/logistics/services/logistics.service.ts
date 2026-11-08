import type { LogisticsOrder } from '@/lib/logistics/orders';
import { LOGISTICS_BUCKET } from '@/lib/logistics/bucket';
import { uploadToSignedUrl } from '@/lib/supabase/client-upload';

export type LogisticsScope = 'open' | 'closed';

/** Lo que logística deja al recibir: las fotos ya elegidas, la observación y si algo llegó mal. */
export interface ReceptionForm {
  files: File[];
  observation: string;
  damaged: boolean;
}

async function leer(res: Response): Promise<any> {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? 'No pudimos completar la operación.');
  return json;
}

function enviar(url: string, method: 'POST' | 'PATCH', body: unknown) {
  return fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

/**
 * Sube las fotos directo al bucket con un permiso firmado por foto y devuelve
 * sus rutas temporales, que son las que se mandan al recibir.
 */
async function subirFotos(files: File[]): Promise<string[]> {
  if (files.length === 0) return [];
  const json = await leer(
    await enviar('/api/logistics/uploads', 'POST', { files: files.map((f) => ({ type: f.type, size: f.size })) })
  );
  const tickets = json.data as { path: string; token: string }[];
  await Promise.all(tickets.map((t, i) => uploadToSignedUrl(LOGISTICS_BUCKET, t.path, t.token, files[i])));
  return tickets.map((t) => t.path);
}

async function cuerpo(form: ReceptionForm) {
  return { photos: await subirFotos(form.files), observation: form.observation, damaged: form.damaged };
}

export const logisticsService = {
  async list(scope: LogisticsScope): Promise<LogisticsOrder[]> {
    const json = await leer(await fetch(`/api/logistics/orders?scope=${scope}`));
    return json.data as LogisticsOrder[];
  },

  /** Logística recibió en la bahía la parte de una tienda, con fotos de cómo llegó. */
  async receive(storeOrderId: string, form: ReceptionForm): Promise<{ order: LogisticsOrder; deliveryError: string | null }> {
    const json = await leer(
      await enviar(`/api/logistics/store-orders/${storeOrderId}/receive`, 'POST', await cuerpo(form))
    );
    return { order: json.data as LogisticsOrder, deliveryError: json.deliveryError ?? null };
  },

  /** Agrega fotos o cambia la observación de una parte ya recibida. */
  async updateEvidence(storeOrderId: string, form: ReceptionForm): Promise<LogisticsOrder> {
    const json = await leer(
      await enviar(`/api/logistics/store-orders/${storeOrderId}/evidence`, 'PATCH', await cuerpo(form))
    );
    return json.data as LogisticsOrder;
  },

  /** Le entregó el pedido al domiciliario: «En camino». */
  async dispatch(orderId: string): Promise<LogisticsOrder> {
    const json = await leer(await fetch(`/api/logistics/orders/${orderId}/dispatch`, { method: 'POST' }));
    return json.data as LogisticsOrder;
  },
};
