'use client';

import { useState, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { passwordChangeService } from '../services/password-change.service';
import { useResendCooldown } from '@/app/hooks/use-resend-cooldown';

export const MIN_PASSWORD_LENGTH = 8;

export function usePasswordChange() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { cooldownSeconds, startCooldown } = useResendCooldown();

  const capturar = (e: unknown, fallback: string) => {
    setError(e instanceof Error ? e.message : fallback);
    const retry = (e as { retryAfterSeconds?: number })?.retryAfterSeconds;
    if (retry) startCooldown(retry);
  };

  /** Paso 1: confirma la contraseña actual y pide el código al correo. */
  const requestCode = useCallback(
    async (currentPassword: string) => {
      try {
        setLoading(true);
        setError(null);
        const data = await passwordChangeService.requestCode(currentPassword);
        startCooldown(data.cooldownSeconds ?? 0);
        return true;
      } catch (e: unknown) {
        capturar(e, 'Error enviando el código');
        return false;
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [startCooldown]
  );

  /** Paso 2: con el código confirmado, aplica la contraseña nueva. */
  const changePassword = useCallback(
    async (code: string, newPassword: string, confirmPassword: string) => {
      // Validar acá y no solo en el servidor: el usuario debe ver por qué no
      // avanza. El flujo de recuperación hacía `return` en silencio.
      if (newPassword !== confirmPassword) {
        setError('Las contraseñas no coinciden');
        return false;
      }

      if (newPassword.length < MIN_PASSWORD_LENGTH) {
        setError(`La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
        return false;
      }

      try {
        setLoading(true);
        setError(null);
        await passwordChangeService.changePassword(code, newPassword);

        // Cambiar la contraseña invalida los tokens anteriores; se refresca para
        // que el navegador no se quede con una sesión que ya no sirve.
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.refreshSession();

        return true;
      } catch (e: unknown) {
        capturar(e, 'Error cambiando la contraseña');
        return false;
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const reset = useCallback(() => setError(null), []);

  return { loading, error, cooldownSeconds, requestCode, changePassword, reset };
}
