/**
 * Guarda el aviso de «se puede instalar» (`beforeinstallprompt`) apenas llega.
 *
 * El navegador lo dispara una sola vez, al cargar la página. El botón vive en
 * el menú lateral, que se monta después —por ejemplo, al iniciar sesión—, y
 * para entonces el evento ya pasó. Por eso lo captura `ServiceWorkerRegister`,
 * que está en el layout raíz desde el primer momento, y el botón lo lee de acá.
 */

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let pending: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

/** Se llama una vez, desde el layout raíz. */
export function captureInstallPrompt(): () => void {
  const onBeforeInstall = (event: Event) => {
    // Sin esto Chrome muestra su propio aviso; el botón del menú es el que lo ofrece.
    event.preventDefault();
    pending = event as BeforeInstallPromptEvent;
    notify();
  };
  const onInstalled = () => {
    pending = null;
    notify();
  };

  window.addEventListener('beforeinstallprompt', onBeforeInstall);
  window.addEventListener('appinstalled', onInstalled);
  return () => {
    window.removeEventListener('beforeinstallprompt', onBeforeInstall);
    window.removeEventListener('appinstalled', onInstalled);
  };
}

export function getInstallPrompt(): BeforeInstallPromptEvent | null {
  return pending;
}

/** El evento sirve una sola vez. */
export function clearInstallPrompt() {
  pending = null;
  notify();
}

export function subscribeInstallPrompt(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
