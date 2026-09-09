'use client';

import { useState, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { passwordChangeService } from '../services/password-change.service';

export const MIN_PASSWORD_LENGTH = 8;

export function usePasswordChange() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string, confirmPassword: string) => {
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
        await passwordChangeService.changePassword(currentPassword, newPassword);

        // El servidor reautenticó con `signInWithPassword`, lo que rota la
        // sesión; se refresca para que el navegador no se quede con la vieja.
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.refreshSession();

        return true;
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Error cambiando la contraseña');
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const reset = useCallback(() => setError(null), []);

  return { loading, error, changePassword, reset };
}
