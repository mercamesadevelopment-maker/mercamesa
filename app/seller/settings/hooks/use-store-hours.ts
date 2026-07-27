'use client';

import { useCallback, useState } from 'react';
import { storeHoursService } from '../services/store-hours.service';
import {
  createDefaultBusinessHours,
  type BusinessHours,
} from '@/components/ui/business-hours/business-hours-editor';

export function useStoreHours(storeId: string | null) {
  const [businessHours, setBusinessHours] = useState<BusinessHours>(createDefaultBusinessHours());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHours = useCallback(async () => {
    if (!storeId) return;
    try {
      setLoading(true);
      setError(null);
      const store = await storeHoursService.getStore(storeId);
      setBusinessHours(
        Array.isArray(store.business_hours) && store.business_hours.length === 7
          ? store.business_hours
          : createDefaultBusinessHours()
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando el horario');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  const saveHours = useCallback(async () => {
    if (!storeId) return;
    try {
      setSaving(true);
      setError(null);
      const result = await storeHoursService.updateHours(storeId, businessHours);
      setBusinessHours(result.business_hours);
      return result;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error guardando el horario');
      throw e;
    } finally {
      setSaving(false);
    }
  }, [storeId, businessHours]);

  return { businessHours, setBusinessHours, loading, saving, error, fetchHours, saveHours };
}
