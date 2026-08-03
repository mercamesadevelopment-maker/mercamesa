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
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-fraunces text-mm-g leading-tight">Ofertas del Día 🔥</h2>
                <p className="text-sm text-mm-txs">Ahorra con estos descuentos exclusivos de nuestras tiendas.</p>
              </div>
              <Button 
                variant="ghost" 
                className="text-mm-g font-bold"
                onClick={() => router.push('/promotions')}
              >
                Ver todas <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex gap-6 overflow-x-auto pb-6 scrollbar-hide -mx-2 px-2">
              {offers.slice(0, 3).map(offer => {
                const product = offer.store_products?.catalog_products;
                return (
                  <motion.div 
                    key={offer.id} 
                    whileHover={{ y: -5 }}
                    className="min-w-[300px] md:min-w-[380px] bg-white rounded-[32px] border border-mm-crd shadow-sm overflow-hidden flex h-40 group cursor-pointer"
                    onClick={() => setSelectedOffer(offer)}
                  >
                    <div className="w-1/3 bg-mm-gbg flex items-center justify-center text-4xl group-hover:scale-110 transition-transform overflow-hidden">
                      {offer.imageSignedUrl ? (
                        <img src={offer.imageSignedUrl} alt={product?.name || 'Oferta'} className="w-full h-full object-cover" />
                      ) : (
                        <span>🎁</span>
                      )}
                    </div>
                    <div className="p-5 w-2/3 flex flex-col justify-between">
                      <div>
                        <Badge variant="oro" className="mb-2 text-[10px] uppercase font-bold tracking-widest">
                          {offer.label || 'OFERTA'}
                        </Badge>
                        <h3 className="font-bold text-mm-g leading-tight mb-1 group-hover:text-mm-oro transition-colors truncate">
                          {product?.name || 'Producto en Oferta'}
                        </h3>
                        <p className="text-[10px] text-mm-txw font-bold uppercase tracking-tighter truncate">
                          {offer.store_products?.stores?.name || 'Tienda'}
                        </p>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="bg-rl text-r px-3 py-1 rounded-full font-bold text-sm">
                          {offer.discount_pct ? `${offer.discount_pct}% OFF` : `-$${offer.special_price?.toLocaleString('es-CO')}`}
                        </span>
                        <div className="w-8 h-8 rounded-full bg-mm-g/10 flex items-center justify-center text-mm-g">
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

