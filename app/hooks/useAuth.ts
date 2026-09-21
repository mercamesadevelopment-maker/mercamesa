import { useState } from 'react';
import { ApiError, authService } from '../services/auth.service';
import { useApp, resolveRoleKey } from '@/src/store';
import { RoleKey } from '@/src/types';

export function useAuthHooks() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Junto al mensaje se guarda el motivo, para que un formulario pueda
  // reaccionar (ofrecer iniciar sesión si el correo ya tiene cuenta) sin
  // comparar textos.
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const { dispatch } = useApp();

  /** Guarda el error para mostrarlo y devuelve el mensaje. */
  const capture = (err: unknown, fallback: string) => {
    const message = err instanceof Error ? err.message : fallback;
    setError(message);
    setErrorCode(err instanceof ApiError ? err.code : null);
    return message;
  };

  const clear = () => {
    setError(null);
    setErrorCode(null);
  };

const login = async (email: string, password: string) => {
  try {
    setLoading(true);
    clear();

    const data = await authService.login(email, password);

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
  } catch (err: unknown) {
    capture(err, 'Error al iniciar sesión');

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

  return { login, register, registerBuyer, forgotPassword, verifyResetCode, resetPassword, logout, loading, error, errorCode };
}
