'use client';
import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { Badge, Button } from '@/src/components/Shared';
import { usePublicOffers } from './hooks/usePublicOffers';
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
            <div className="flex gap-4 sm:gap-6 overflow-x-auto pb-6 scrollbar-hide -mx-2 px-2">
              {offers.slice(0, 3).map(offer => {
                const product = offer.store_products?.catalog_products;
                return (
                  /* 280px en móvil: con 300px sobre 343px útiles solo asomaban 43px de
                     la siguiente y se leía como una tarjeta cortada. Con 280 asoman 63. */
                  <motion.div 
                    key={offer.id} 
                    whileHover={{ y: -5 }}
                    className="shrink-0 min-w-[280px] sm:min-w-[320px] md:min-w-[380px] bg-white rounded-[32px] border border-mm-crd shadow-sm overflow-hidden flex h-36 sm:h-40 group cursor-pointer"
                    onClick={() => setSelectedOffer(offer)}
                  >
                    <div className="w-1/3 bg-mm-gbg flex items-center justify-center text-4xl group-hover:scale-110 transition-transform overflow-hidden">
                      {offer.imageSignedUrl ? (
                        <img src={offer.imageSignedUrl} alt={product?.name || 'Oferta'} className="w-full h-full object-cover" />
                      ) : (
                        <span>🎁</span>
                      )}
                    </div>
                    <div className="p-4 sm:p-5 w-2/3 min-w-0 flex flex-col justify-between">
                      <div>
                        {/* `offer.label` es texto libre del admin: sin truncate envolvía a
                            dos o tres líneas, reventaba el alto fijo de la tarjeta y se
                            llevaba por delante la fila de precio. */}
                        <Badge variant="oro" className="mb-2 inline-block max-w-full truncate align-top text-[10px] uppercase font-bold tracking-widest">
                          {offer.label || 'OFERTA'}
                        </Badge>
                        <h3 className="font-bold text-mm-g leading-tight mb-1 group-hover:text-mm-oro transition-colors truncate">
                          {product?.name || 'Producto en Oferta'}
                        </h3>
                        <p className="text-[10px] text-mm-txw font-bold uppercase tracking-tighter truncate">
                          {offer.store_products?.stores?.name || 'Tienda'}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-2 min-w-0 mt-2">
                        <span className="min-w-0 truncate bg-rl text-r px-3 py-1 rounded-full font-bold text-sm">
                          {offer.discount_pct ? `${offer.discount_pct}% Descuento` : `-$${offer.special_price?.toLocaleString('es-CO')}`}
                        </span>
                        <div className="w-8 h-8 shrink-0 rounded-full bg-mm-g/10 flex items-center justify-center text-mm-g">
                            <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
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

