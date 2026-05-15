import React, { useState, useEffect } from 'react';
import { StoreOffer } from '../../admin/offers/hooks/useOffers';

export function usePublicOffers() {
  const [offers, setOffers] = useState<StoreOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOffers = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/offers');
        const result = await response.json();
        
        if (!response.ok) throw new Error(result.error);
        
        // Filter only active offers
        const activeOffers = (result.data || []).filter((offer: StoreOffer) => {
          if (!offer.is_active) return false;
          if (offer.ends_at && new Date(offer.ends_at) < new Date()) return false;
          return true;
        });

        setOffers(activeOffers);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error fetching offers';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchOffers();
  }, []);

  return { offers, loading, error };
}
