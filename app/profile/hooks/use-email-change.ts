'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '@/src/store';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { emailChangeService } from '../services/email-change.service';

export function useEmailChange() {
  const { dispatch } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const startCooldown = useCallback((seconds: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setCooldownSeconds(seconds);
    intervalRef.current = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

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

      dispatch({ type: 'UPDATE_BUYER_PROFILE', profile: { email } });

      return email;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error verificando el código');
      return null;
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  return { loading, error, cooldownSeconds, requestChange, verifyChange };
}
