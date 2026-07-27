'use client';

import { useCallback, useState } from 'react';
import { useApp } from '@/src/store';
import {
  fetchFavoriteStores,
  fetchFavoriteStoreIds,
  addFavoriteDb,
  removeFavoriteDb,
} from '../services/favorites.service';
import type { FavoriteStore } from '../types/favorite.types';

export function useFavorites() {
  const { state } = useApp();
  const buyerId = state.buyerProfile?.id;

  const [favoriteStores, setFavoriteStores] = useState<FavoriteStore[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFavorites = useCallback(async () => {
    if (!buyerId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await fetchFavoriteStores(buyerId);
      setFavoriteStores(data);
      setFavoriteIds(new Set(data.map((f) => f.storeId)));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando favoritos');
    } finally {
      setLoading(false);
    }
  }, [buyerId]);

  const fetchFavoriteIds = useCallback(async () => {
    if (!buyerId) return;
    try {
      const ids = await fetchFavoriteStoreIds(buyerId);
      setFavoriteIds(new Set(ids));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando favoritos');
    }
  }, [buyerId]);

  const isFavorite = useCallback((storeId: string) => favoriteIds.has(storeId), [favoriteIds]);

  const toggleFavorite = useCallback(
    async (storeId: string) => {
      if (!buyerId) return;
      const wasFavorite = favoriteIds.has(storeId);

      // Optimistic update
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFavorite) next.delete(storeId);
        else next.add(storeId);
        return next;
      });

      try {
        if (wasFavorite) {
          await removeFavoriteDb(buyerId, storeId);
          setFavoriteStores((prev) => prev.filter((f) => f.storeId !== storeId));
        } else {
          await addFavoriteDb(buyerId, storeId);
        }
      } catch (e: unknown) {
        // Revert optimistic update on failure
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (wasFavorite) next.add(storeId);
          else next.delete(storeId);
          return next;
        });
        setError(e instanceof Error ? e.message : 'Error actualizando favoritos');
      }
    },
    [buyerId, favoriteIds]
  );

  const removeFavorite = useCallback(
    async (storeId: string) => {
      if (!buyerId) return;
      try {
        await removeFavoriteDb(buyerId, storeId);
        setFavoriteStores((prev) => prev.filter((f) => f.storeId !== storeId));
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          next.delete(storeId);
          return next;
        });
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Error eliminando favorito');
        throw e;
      }
    },
    [buyerId]
  );

  return {
    favoriteStores,
    favoriteIds,
    loading,
    error,
    fetchFavorites,
    fetchFavoriteIds,
    isFavorite,
    toggleFavorite,
    removeFavorite,
  };
}
