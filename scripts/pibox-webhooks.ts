/**
 * scripts/pibox-webhooks.ts
 *
 * Gestiona los webhooks de Pibox desde la línea de comandos.
 *
 * La cuenta de Picap/Pibox no tiene ninguna pantalla para administrarlos: los
 * webhooks solo existen vía API (POST/GET/DELETE /third/hooks), así que este
 * script es el único punto de entrada para registrarlos, verlos y borrarlos.
 *
 * Uso (sin `--`: pnpm lo pasaría como un argumento literal más):
 *   pnpm pibox:hooks list
 *   pnpm pibox:hooks register https://mercamesa.vercel.app
 *   pnpm pibox:hooks delete <HOOK_ID>
 *   pnpm pibox:hooks sync https://mercamesa.vercel.app   (borra y recrea)
 *
 * Requiere PIBOX_API_TOKEN y, para registrar, PIBOX_WEBHOOK_SECRET.
 */
import 'dotenv/config';
import {
  listWebhooks,
  deleteWebhook,
  registerMercamesaWebhooks,
} from '../lib/pibox/services/webhook.service';
import { PIBOX_WEBHOOK_EVENT } from '../lib/pibox/constants';
import type { PiboxHook } from '../lib/pibox/types';

const EVENT_LABEL: Record<number, string> = {
  [PIBOX_WEBHOOK_EVENT.BOOKING_UPDATED]: 'Pedido (booking)',
  [PIBOX_WEBHOOK_EVENT.PACKAGE_UPDATED]: 'Paquete (package)',
  [PIBOX_WEBHOOK_EVENT.PREPACKAGE_UPDATED]: 'Pre-paquete (no lo consumimos)',
};

function printHooks(hooks: PiboxHook[]) {
  if (hooks.length === 0) {
    console.log('  (no hay webhooks registrados)');
    return;
  }
  for (const hook of hooks) {
    const label = EVENT_LABEL[hook.event_cd] ?? `evento ${hook.event_cd}`;
    // Nunca se imprime el valor del secreto, solo si viaja o no.
    const hasSecret = Boolean(hook.headers && hook.headers['x-pibox-secret']);
    console.log(`  - ${hook._id}`);
    console.log(`      evento : ${hook.event_cd} — ${label}`);
    console.log(`      url    : ${hook.url}`);
    console.log(`      secreto: ${hasSecret ? 'sí (x-pibox-secret)' : 'NO — el receptor lo rechazará'}`);
  }
}

function assertBaseUrl(baseUrl: string | undefined): string {
  if (!baseUrl) {
    console.error('Falta la URL base. Ej: pnpm pibox:hooks register https://mercamesa.vercel.app');
    process.exit(1);
  }
  if (!baseUrl.startsWith('https://')) {
    // Pibox llama desde internet: una URL local o sin TLS nunca va a recibir nada.
    console.error(`La URL debe ser https y pública. Recibí: ${baseUrl}`);
    process.exit(1);
  }
  return baseUrl;
}

async function main() {
  const [command, arg] = process.argv.slice(2);

  if (!process.env.PIBOX_API_TOKEN) {
    console.error('Falta PIBOX_API_TOKEN en el entorno.');
    process.exit(1);
  }

  switch (command) {
    case 'list': {
      const hooks = await listWebhooks();
      console.log(`Webhooks registrados (${hooks.length}):`);
      printHooks(hooks);
      break;
    }

    case 'register': {
      const baseUrl = assertBaseUrl(arg);
      const created = await registerMercamesaWebhooks(baseUrl);
      console.log(`Webhooks creados (${created.length}):`);
      printHooks(created);
      break;
    }

    case 'delete': {
      if (!arg) {
        console.error('Falta el HOOK_ID. Ej: pnpm pibox:hooks delete 5d7f23ec56c97100147bfba2');
        process.exit(1);
      }
      const deleted = await deleteWebhook(arg);
      console.log('Webhook eliminado:');
      printHooks([deleted]);
      break;
    }

    case 'sync': {
      // Útil al cambiar de dominio: deja exactamente un hook por evento.
      const baseUrl = assertBaseUrl(arg);
      const existing = await listWebhooks();

      if (existing.length > 0) {
        console.log(`Eliminando ${existing.length} webhook(s) previo(s)...`);
        for (const hook of existing) {
          await deleteWebhook(hook._id);
          console.log(`  - eliminado ${hook._id} (evento ${hook.event_cd})`);
        }
      }

      const created = await registerMercamesaWebhooks(baseUrl);
      console.log(`\nWebhooks creados (${created.length}):`);
      printHooks(created);
      break;
    }

    default:
      console.log(`Comandos disponibles:
  list                 Lista los webhooks registrados
  register <URL_BASE>  Registra los eventos 0 (pedido) y 1 (paquete)
  delete   <HOOK_ID>   Elimina un webhook
  sync     <URL_BASE>  Elimina todos y vuelve a registrar

Ejemplo:
  pnpm pibox:hooks register https://mercamesa.vercel.app`);
      process.exit(command ? 1 : 0);
  }
}

main().catch((err) => {
  console.error('\nError:', err instanceof Error ? err.message : err);
  process.exit(1);
});
