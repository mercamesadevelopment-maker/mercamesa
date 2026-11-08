'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Cuenta regresiva para poder reenviar un código.
 *
 * Vivía dentro de `use-email-change`, pero la espera es la misma en los cuatro
 * flujos que mandan códigos (correo, contraseña, registro e ingreso de
 * administradores) y el servidor la impone igual en todos. Copiarla era copiar
 * también el `clearInterval` del desmontaje, que es lo que se olvida.
 *
 * Vive en `app/hooks` y no junto a un flujo porque lo usan tanto el perfil como
 * el ingreso.
 */
export function useResendCooldown() {
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startCooldown = useCallback(
    (seconds: number) => {
      stop();
      if (!seconds || seconds <= 0) {
        setCooldownSeconds(0);
        return;
      }

      setCooldownSeconds(seconds);
      intervalRef.current = setInterval(() => {
        setCooldownSeconds((prev) => {
          if (prev <= 1) {
            stop();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    },
    [stop]
  );

  // Sin esto, el intervalo sigue corriendo y actualizando estado después de
  // cerrar el modal.
  useEffect(() => stop, [stop]);

  return { cooldownSeconds, startCooldown };
}
