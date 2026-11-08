'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  clearInstallPrompt,
  getInstallPrompt,
  subscribeInstallPrompt,
} from '../install-prompt-store';

/**
 * Qué se le puede ofrecer al usuario para instalar MercaMesa como app.
 *
 * - `prompt`: Android, Chrome o Edge de escritorio. El navegador avisó que se
 *   puede instalar (`beforeinstallprompt`) y el botón abre su diálogo.
 * - `ios`: iPhone o iPad. Safari no tiene ese evento: solo se instala desde
 *   Compartir → «Agregar a pantalla de inicio», así que se muestra una guía.
 * - `none`: ya está instalada (se abrió como app) o el navegador no lo permite.
 */
export type InstallMode = 'prompt' | 'ios' | 'none';

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari de iOS lo expone así, no con display-mode.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  // El iPad con iPadOS se presenta como Mac; se distingue por la pantalla táctil.
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

function currentMode(): InstallMode {
  if (isStandalone()) return 'none';
  if (isIos()) return 'ios';
  return getInstallPrompt() ? 'prompt' : 'none';
}

export function useInstallPrompt() {
  const [mode, setMode] = useState<InstallMode>('none');

  useEffect(() => {
    setMode(currentMode());
    return subscribeInstallPrompt(() => setMode(currentMode()));
  }, []);

  /** Abre el diálogo de instalación del navegador. Solo sirve en modo `prompt`. */
  const install = useCallback(async () => {
    const event = getInstallPrompt();
    if (!event) return;
    await event.prompt();
    await event.userChoice;
    // El evento sirve una sola vez; si lo rechazó, Chrome lo vuelve a disparar más adelante.
    clearInstallPrompt();
  }, []);

  return { mode, install };
}
