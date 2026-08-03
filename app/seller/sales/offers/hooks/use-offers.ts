import { useEffect } from 'react';
import { useSellerStore } from '@/app/hooks/use-seller-store';
import { useOffers as useOffersData } from '@/src/features/offers/hooks/use-offers';

export function useOffers() {
  const { stores, storeId, storeName, selectStore } = useSellerStore();
  const { offers, loading, error, fetchOffers, saveOffer, deleteOffer } = useOffersData();

  useEffect(() => {
    if (storeId) fetchOffers(storeId);
  }, [storeId, fetchOffers]);

  return {
    offers,
    loading: loading || !storeId,
    error,
    saveOffer: (id: string | null, data: Parameters<typeof saveOffer>[1]) =>
      saveOffer(id, data, storeId ?? undefined),
    deleteOffer: (id: string) => deleteOffer(id, storeId ?? undefined),
    stores,
    storeId,
    storeName,
    selectStore,
  };
}
