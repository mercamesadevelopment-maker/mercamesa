'use client';

import { useState, useCallback } from 'react';
import { useApp } from '@/src/store';
import { accountService } from '../services/account.service';
import type { AccountProfile } from '../types/account.types';

export function useAccount() {
  const { dispatch } = useApp();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await accountService.getProfile();
      setProfile(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando el perfil');
    } finally {
      setLoading(false);
    }
  }, []);

  const saveProfile = useCallback(async (payload: Record<string, unknown>) => {
    try {
      setSaving(true);
      setError(null);
      const data = await accountService.updateProfile(payload);
      setProfile(data);
      dispatch({
        type: 'UPDATE_BUYER_PROFILE',
        profile: {
          name: data.full_name,
          phone: data.phone || '',
          avatar: data.avatarSignedUrl || '',
        },
      });
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error guardando el perfil');
      return false;
    } finally {
      setSaving(false);
    }
  }, [dispatch]);

  return { profile, loading, saving, error, fetchProfile, saveProfile };
}
