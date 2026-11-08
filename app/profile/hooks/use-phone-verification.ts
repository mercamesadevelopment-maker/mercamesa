'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { accountService } from '../services/account.service';
import {
  requestPhoneVerificationCode,
  type PhoneVerificationCode,
} from '../services/phone-verification.service';

/** Cada cuánto se mira si Carolina ya recibió el código. */
const POLL_MS = 3000;

/**
 * El código para verificar el teléfono, y la espera hasta que llegue.
 *
 * La verificación no pasa en esta pantalla: pasa cuando el usuario manda el
 * código por WhatsApp y Meteor lo confirma. Por eso, mientras el modal está
 * abierto, se pregunta al perfil hasta que quede verificado o venza el código.
 */
export function usePhoneVerification(onVerified: () => void) {
  const [current, setCurrent] = useState<PhoneVerificationCode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const onVerifiedRef = useRef(onVerified);
  onVerifiedRef.current = onVerified;

  const request = useCallback(async () => {
    setLoading(true);
    setError(null);
    setExpired(false);
    try {
      setCurrent(await requestPhoneVerificationCode());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No pudimos generar el código.');
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setCurrent(null);
    setError(null);
    setExpired(false);
  }, []);

  useEffect(() => {
    if (!current || expired) return;
    const timer = setInterval(async () => {
      if (Date.now() >= new Date(current.expiresAt).getTime()) {
        setExpired(true);
        return;
      }
      try {
        const profile = await accountService.getProfile();
        if (profile.phone_verified_at) {
          setCurrent(null);
          onVerifiedRef.current();
        }
      } catch {
        // Un fallo de red no corta la espera: se vuelve a preguntar.
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [current, expired]);

  return { current, loading, error, expired, request, reset };
}
