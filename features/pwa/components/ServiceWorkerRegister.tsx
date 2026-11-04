'use client';

import { useEffect } from 'react';
import { captureInstallPrompt } from '../install-prompt-store';

/**
 * Registra el service worker (`public/sw.js`), que es lo que permite instalar
 * MercaMesa como app y mostrar la pantalla sin conexión, y guarda el aviso de
 * «se puede instalar» para el botón del menú (ver `install-prompt-store`).
 *
 * El service worker solo en producción: en desarrollo se interpone en la
 * recarga en caliente y hace creer que un cambio no se aplicó.
 */
export function ServiceWorkerRegister() {
  useEffect(() => captureInstallPrompt(), []);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch((err) => console.error('No se pudo registrar el service worker:', err));
  }, []);

  return null;
}
