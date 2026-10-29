'use client';

import { useState, useCallback } from 'react';
import { useSession } from '@/features/auth/session-context';
import { accountService } from '../services/account.service';
import type { AccountProfile } from '../types/account.types';

export function useAccount() {
  const { updateProfile } = useSession();
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
      updateProfile({
          name: data.full_name,
          avatar: data.avatarSignedUrl || '',
        });
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error guardando el perfil');
      return false;
    } finally {
      setSaving(false);
    }
  }, [updateProfile]);

  return { profile, loading, saving, error, fetchProfile, saveProfile };
}
