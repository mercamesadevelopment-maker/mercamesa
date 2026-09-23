'use client';
import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/src/components/Shared';
import { usePublicOffers } from './hooks/usePublicOffers';
import { OfferCard } from './components/OfferCard';
import { OfferDetailModal } from './components/OfferDetailModal';
import { StoreOffer } from '@/src/features/offers/types/offer.types';
import { PlazaList } from './components/PlazaList';

export default function MarketplacesPage() {
  const router = useRouter();
  const { offers, loading } = usePublicOffers();
  const [selectedOffer, setSelectedOffer] = useState<StoreOffer | null>(null);

  return (
    <div className="pb-24">
      {/* Ofertas del Día Section */}
      {!loading && offers.length > 0 && (
        <div className="px-4 lg:px-8 max-w-7xl mx-auto pt-8">
          <div className="mb-12">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-6">
              <div>
                <h2 className="text-2xl sm:text-3xl font-fraunces text-mm-g leading-tight">Ofertas del Día 🔥</h2>
                <p className="text-sm text-mm-txs">Ahorra con estos descuentos exclusivos de nuestras tiendas.</p>
              </div>
              <Button
                variant="ghost"
                className="text-mm-g font-bold shrink-0 whitespace-nowrap self-start sm:self-auto"
                onClick={() => router.push('/promotions')}
              >
                Ver todas <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            {/* Dos columnas desde móvil: cada tarjeta mide ~165px a 375px, por eso todo lo de adentro se compacta por debajo de `sm`.
                Cuatro en una sola fila a partir de `lg`, que son exactamente las que se muestran. */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              {offers.slice(0, 4).map(offer => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  onClick={() => setSelectedOffer(offer)}
                  showStore
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Rest of the original MarketView - now PlazaList */}
      <PlazaList />

      <OfferDetailModal
        offer={selectedOffer}
        onClose={() => setSelectedOffer(null)}
      />
    </div>
  );
}
