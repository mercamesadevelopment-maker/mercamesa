import { useState } from 'react';
import { ApiError, authService } from '../services/auth.service';
import { useApp, resolveRoleKey } from '@/src/store';
import { RoleKey } from '@/src/types';
import { useResendCooldown } from './use-resend-cooldown';

export function useAuthHooks() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Junto al mensaje se guarda el motivo, para que un formulario pueda
  // reaccionar (ofrecer iniciar sesión si el correo ya tiene cuenta) sin
  // comparar textos.
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const { dispatch } = useApp();
  const { cooldownSeconds, startCooldown } = useResendCooldown();

  /** Guarda el error para mostrarlo y devuelve el mensaje. */
  const capture = (err: unknown, fallback: string) => {
    const message = err instanceof Error ? err.message : fallback;
    setError(message);
    setErrorCode(err instanceof ApiError ? err.code : null);

    // Un 429 trae cuántos segundos faltan: se arranca la cuenta con ese valor
    // para que el botón de reenviar no invite a chocar de nuevo contra el mismo
    // límite.
    if (err instanceof ApiError && err.retryAfterSeconds) {
      startCooldown(err.retryAfterSeconds);
    }

    return message;
  };

  const clear = () => {
    setError(null);
    setErrorCode(null);
  };

  /**
   * Deja la sesión puesta en el estado de la app. Lo comparten el ingreso normal
   * y el segundo paso de admin/superadmin, que terminan igual: con un perfil.
   */
  const entrar = (data: any, email: string) => {
    const profile = data.profile || {};
    const user = data.user || {};
    const roleKey = resolveRoleKey(profile.roles?.name, profile.buyer_type);

    dispatch({
      type: 'LOGIN',
      role: roleKey,
      profile: {
        id: user.id,
        email,
        name: profile.full_name || '',
        avatar: profile.avatar_url || '',
        role_id: profile.role_id,
      },
    });

    return { ...data, roleKey };
  };

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      clear();

      const data = await authService.login(email, password);

      // Admin y superadmin todavía no entraron: el servidor mandó un código al
      // correo y no devolvió sesión. Se avisa al formulario para que pida el
      // código, sin tocar el estado de la app.
      if (data.requiresCode) {
        startCooldown(data.cooldownSeconds ?? 0);
        return { requiresCode: true as const, email: data.email as string };
      }

      return entrar(data, email);
    } catch (err: unknown) {
      capture(err, 'Error al iniciar sesión');

      throw err;
    } finally {
      setLoading(false);
    }
  };

  const verifyLoginCode = async (email: string, code: string) => {
    try {
      setLoading(true);
      clear();

      const data = await authService.verifyLoginCode(email, code);
      return entrar(data, email);
    } catch (err: unknown) {
      capture(err, 'Error al verificar el código');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const requestSignupCode = async (email: string) => {
    try {
      setLoading(true);
      clear();
      const data = await authService.requestSignupCode(email);
      startCooldown(data.cooldownSeconds ?? 0);
      return data;
    } catch (err: unknown) {
      capture(err, 'Error al enviar el código');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (payload: { email: string; password: string; full_name: string; phone?: string; role_id: string; roleKey: RoleKey; person_type_id?: string; identification_type_id?: string; document_number?: string }) => {
    try {
      setLoading(true);
      clear();
      const data = await authService.register(payload);
      return data;
    } catch (err: unknown) {
      capture(err, 'Error al registrar');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const registerBuyer = async (payload: {
    email: string;
    password: string;
    person_type_id: string;
    identification_type_id: string;
    document_number: string;
    full_name?: string;
    business_name?: string;
    contact_name?: string;
    phone: string;
    buyer_type: 'retail' | 'wholesale';
    terms_version: string;
    code: string;
  }) => {
    try {
      setLoading(true);
      clear();
      const data = await authService.registerBuyer(payload);
      return data;
    } catch (err: unknown) {
      capture(err, 'Error al registrar');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      setLoading(true);
      clear();
      return await authService.forgotPassword(email);
    } catch (err: unknown) {
      capture(err, 'Error al solicitar el código');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const verifyResetCode = async (email: string, code: string) => {
    try {
      setLoading(true);
      clear();
      return await authService.verifyResetCode(email, code);
    } catch (err: unknown) {
      capture(err, 'Error al verificar el código');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string, resetToken: string, newPassword: string) => {
    try {
      setLoading(true);
      clear();
      return await authService.resetPassword(email, resetToken, newPassword);
    } catch (err: unknown) {
      capture(err, 'Error al restablecer la contraseña');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
      dispatch({ type: 'LOGOUT' });
    } catch (err) {
      console.error(err);
    }
  };

  return {
    login,
    verifyLoginCode,
    requestSignupCode,
    register,
    registerBuyer,
    forgotPassword,
    verifyResetCode,
    resetPassword,
    logout,
    loading,
    error,
    errorCode,
    cooldownSeconds,
  };
}
