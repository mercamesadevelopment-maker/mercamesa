import { piboxFetch } from '../client';
import { PIBOX_WEBHOOK_EVENT } from '../constants';
import type { PiboxHook } from '../types';

/**
 * Registra un webhook. Pibox reenvía los `headers` que se declaren acá en cada
 * notificación, y eso es lo único que permite autenticar el receptor: se
 * registra un secreto propio que app/api/pibox/webhook valida.
 */
export async function registerWebhook(url: string, eventCd: number): Promise<PiboxHook> {
  const secret = process.env.PIBOX_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error(
      'Falta PIBOX_WEBHOOK_SECRET: sin ese header el receptor no puede distinguir un evento legítimo de uno falso.'
    );
  }

  return piboxFetch<PiboxHook>('/hooks', {
    method: 'POST',
    body: JSON.stringify({
      hook: {
        url,
        event_cd: eventCd,
        headers: { 'x-pibox-secret': secret },
      },
    }),
  });
}

export async function listWebhooks(): Promise<PiboxHook[]> {
  return piboxFetch<PiboxHook[]>('/hooks');
}

export async function deleteWebhook(hookId: string): Promise<PiboxHook> {
  return piboxFetch<PiboxHook>(`/hooks/${hookId}`, { method: 'DELETE' });
}

/** Registra los dos eventos que consume Mercamesa: pedido (0) y paquete (1). */
export async function registerMercamesaWebhooks(baseUrl: string): Promise<PiboxHook[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/pibox/webhook`;

  return Promise.all([
    registerWebhook(url, PIBOX_WEBHOOK_EVENT.BOOKING_UPDATED),
    registerWebhook(url, PIBOX_WEBHOOK_EVENT.PACKAGE_UPDATED),
  ]);
}
