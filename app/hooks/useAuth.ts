import { useState } from 'react';
import { authService } from '../services/auth.service';
import { useApp, resolveRoleKey } from '@/src/store';
import { RoleKey } from '@/src/types';

export function useAuthHooks() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { dispatch } = useApp();

const login = async (email: string, password: string) => {
  try {
    setLoading(true);
    setError(null);

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
    const message =
      err instanceof Error
        ? err.message
        : 'Error al iniciar sesión';

    setError(message);

    throw err;
  } finally {
    setLoading(false);
  }
};

  const register = async (payload: { email: string; password: string; full_name: string; phone?: string; role_id: string; roleKey: RoleKey }) => {
    try {
      setLoading(true);
      setError(null);
      const data = await authService.register(payload);
      return data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al registrar';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const registerBuyer = async (payload: {
    email: string;
    password: string;
    person_type: 'natural' | 'juridica';
    document_type: string;
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
      setError(null);
      const data = await authService.registerBuyer(payload);
      return data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al registrar';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      setLoading(true);
      setError(null);
      return await authService.forgotPassword(email);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al solicitar el código';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const verifyResetCode = async (email: string, code: string) => {
    try {
      setLoading(true);
      setError(null);
      return await authService.verifyResetCode(email, code);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al verificar el código';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string, resetToken: string, newPassword: string) => {
    try {
      setLoading(true);
      setError(null);
      return await authService.resetPassword(email, resetToken, newPassword);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al restablecer la contraseña';
      setError(message);
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

  return { login, register, registerBuyer, forgotPassword, verifyResetCode, resetPassword, logout, loading, error };
}
