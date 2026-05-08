import { useState } from 'react';
import { authService } from '../services/auth.service';
import { useApp } from '@/src/store';
import { RoleKey } from '@/src/types';

export function useAuthHooks() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { dispatch } = useApp();

  const login = async (email: string, password: string, roleKey: RoleKey) => {
    try {
      setLoading(true);
      setError(null);
      const data = await authService.login(email, password);
      const profile = data.profile || {};
      const user = data.user || {};
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
      return data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al iniciar sesión';
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

  const logout = async () => {
    try {
      await authService.logout();
      dispatch({ type: 'LOGOUT' });
    } catch (err) {
      console.error(err);
    }
  };

  return { login, register, logout, loading, error };
}
