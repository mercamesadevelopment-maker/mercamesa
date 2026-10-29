'use client';

import { useState, useCallback } from 'react';
import { useSession } from '@/src/features/auth/session-context';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { emailChangeService } from '../services/email-change.service';
import { useResendCooldown } from '@/app/hooks/use-resend-cooldown';

export function useEmailChange() {
  const { updateProfile } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // La cuenta regresiva es la misma en los cuatro flujos que mandan códigos, y
  // vive en un hook compartido.
  const { cooldownSeconds, startCooldown } = useResendCooldown();

  const requestChange = useCallback(async (newEmail: string, currentPassword: string) => {
    try {
      setLoading(true);
      setError(null);
      const result = await emailChangeService.requestChange(newEmail, currentPassword);
      startCooldown(result.cooldownSeconds);
      return true;
    } catch (e: unknown) {
      const err = e as Error & { retryAfterSeconds?: number };
      if (typeof err.retryAfterSeconds === 'number') startCooldown(err.retryAfterSeconds);
      setError(err.message || 'Error solicitando el cambio de correo');
      return false;
    } finally {
      setLoading(false);
    }
  }, [startCooldown]);

  const verifyChange = useCallback(async (code: string) => {
    try {
      setLoading(true);
      setError(null);
      const { email } = await emailChangeService.verifyChange(code);

      const supabase = createSupabaseBrowserClient();
      await supabase.auth.refreshSession();

      updateProfile({ email });

      return email;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error verificando el código');
      return null;
    } finally {
      setLoading(false);
    }
  }, [updateProfile]);

  return { loading, error, cooldownSeconds, requestChange, verifyChange };
}
