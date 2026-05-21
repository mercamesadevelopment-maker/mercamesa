'use client';

import { useState, useCallback } from 'react';
import { useApp } from '@/src/store';
import { addressesService } from '../services/addresses.service';
import type { DeliveryAddress, AddressFormValues } from '../types/address.types';

export function useAddresses() {
  const { dispatch } = useApp();
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAddresses = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await addressesService.getAll();
      setAddresses(data);
      // Sync store so other parts of the app see updated list
      dispatch({
        type: 'UPDATE_BUYER_PROFILE',
        profile: {
          addresses: data.map((a) => ({
            id: a.id,
            label: a.label ?? a.address_line,
            street: a.address_line,
            neighborhood: a.neighborhood ?? '',
            city: a.municipality,
            notes: '',
            isDefault: a.is_default,
            icon: '📍',
          })),
        },
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando direcciones');
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  const createAddress = useCallback(
    async (form: AddressFormValues) => {
      setLoading(true);
      setError(null);
      try {
        const created = await addressesService.create(form);
        // Optimistic: update local list
        setAddresses((prev) => {
          const list = form.is_default
            ? prev.map((a) => ({ ...a, is_default: false }))
            : prev;
          return [...list, created];
        });
        return created;
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Error creando dirección');
        throw e;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const updateAddress = useCallback(
    async (id: string, form: Partial<AddressFormValues>) => {
      setLoading(true);
      setError(null);
      try {
        const updated = await addressesService.update(id, form);
        setAddresses((prev) => {
          let list = prev;
          if (form.is_default) {
            list = prev.map((a) => ({ ...a, is_default: a.id === id }));
          }
          return list.map((a) => (a.id === id ? updated : a));
        });
        return updated;
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Error actualizando dirección');
        throw e;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const deleteAddress = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await addressesService.remove(id);
      setAddresses((prev) => prev.filter((a) => a.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error eliminando dirección');
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { addresses, loading, error, fetchAddresses, createAddress, updateAddress, deleteAddress };
}
