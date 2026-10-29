'use client';
import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
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
      {/* Mientras cargan se reserva el espacio de las cuatro tarjetas: si no, al
          llegar las ofertas empujan las plazas hacia abajo de golpe (CLS). */}
      {loading && (
        <div className="px-4 lg:px-8 max-w-7xl mx-auto pt-8 mb-12" aria-hidden>
          <div className="mb-6 h-14" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="min-h-64 sm:min-h-80 rounded-[28px] bg-mm-gbg animate-pulse" />
            ))}
          </div>
        </div>
      )}

      {/* Ofertas del Día Section */}
      {!loading && offers.length > 0 && (
        <div className="px-4 lg:px-8 max-w-7xl mx-auto pt-8">
          <div className="mb-12">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-6">
              <div>
                <h2 className="text-2xl sm:text-3xl font-display text-mm-g leading-tight">Ofertas del día</h2>
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
              {offers.slice(0, 4).map((offer, i) => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  index={i}
                  // Son cuatro: pocas, y es la vitrina. Ver `destacada` en OfferCard.
                  destacada
                  onClick={() => setSelectedOffer(offer)}
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
