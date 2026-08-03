'use client';

import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Search, ChevronRight } from 'lucide-react';
import { Badge } from '@/src/components/Shared';
import { usePublicOffers } from '@/app/marketplaces/hooks/usePublicOffers';
import { usePublicStores } from '@/app/sections/stores/hooks/usePublicStores';
import { OfferDetailModal } from '@/app/marketplaces/components/OfferDetailModal';
import { StoreOffer } from '@/src/features/offers/types/offer.types';

export default function PromotionsPage() {
  const { offers, loading: loadingOffers } = usePublicOffers();
  const { stores, loading: loadingStores } = usePublicStores();

  const [search, setSearch] = useState('');
  const [storeId, setStoreId] = useState<string>('all');

  const [selectedOffer, setSelectedOffer] = useState<StoreOffer | null>(null);

  const filteredOffers = useMemo(() => {
    return offers.filter(offer => {
      const product = offer.store_products?.catalog_products;

      const matchSearch =
        product?.name?.toLowerCase().includes(search.toLowerCase()) ||
        offer.label?.toLowerCase().includes(search.toLowerCase()) ||
        false;

      const matchStore =
        storeId === 'all' ||
        offer.store_products?.store_id === storeId;

      return matchSearch && matchStore;
    });
  }, [offers, search, storeId]);

  if (loadingOffers || loadingStores) {
    return (
      <div className="p-12 text-center text-mm-txs">
        Cargando promociones...
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8 pb-24">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-fraunces text-mm-g mb-2">
            Promociones y Ofertas 🔥
          </h1>
          <p className="text-mm-txs">
            Ahorra con los mejores descuentos de nuestras tiendas asociadas.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-mm-txw" />

            <input
              type="text"
              placeholder="Buscar ofertas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-mm-crd rounded-full py-2.5 pl-11 pr-4 text-sm outline-none focus:border-mm-g transition-all"
            />
          </div>

          <select
            className="px-4 py-2.5 rounded-full border border-mm-crd text-sm outline-none focus:border-mm-g bg-white"
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
          >
            <option value="all">Todas las Tiendas</option>

            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredOffers.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredOffers.map((offer) => {
            const product = offer.store_products?.catalog_products;

            return (
              <motion.div
                key={offer.id}
                whileHover={{ y: -5 }}
                className="bg-white rounded-[32px] border border-mm-crd shadow-sm overflow-hidden flex flex-col group cursor-pointer"
                onClick={() => setSelectedOffer(offer)}
              >
                <div className="h-48 bg-mm-gbg flex items-center justify-center text-5xl group-hover:scale-105 transition-transform overflow-hidden relative">
                  {offer.imageSignedUrl ? (
                    <img
                      src={offer.imageSignedUrl}
                      alt={product?.name || 'Oferta'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>🎁</span>
                  )}

                  <div className="absolute top-4 left-4">
                    <Badge
                      variant="oro"
                      className="text-[10px] uppercase font-bold tracking-widest shadow-md"
                    >
                      {offer.label || 'OFERTA'}
                    </Badge>
                  </div>
                </div>

                <div className="p-5 flex flex-col flex-grow">
                  <div className="flex-grow">
                    <h3 className="font-bold text-mm-g leading-tight mb-1 group-hover:text-mm-oro transition-colors line-clamp-2">
                      {product?.name || 'Producto en Oferta'}
                    </h3>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-mm-gbg">
                    <span className="bg-rl text-r px-3 py-1 rounded-full font-bold text-sm">
                      {offer.discount_pct
                        ? `${offer.discount_pct}% OFF`
                        : `-$${offer.special_price?.toLocaleString('es-CO')}`}
                    </span>

                    <div className="w-8 h-8 rounded-full bg-mm-g/10 flex items-center justify-center text-mm-g group-hover:bg-mm-g group-hover:text-white transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="py-20 text-center text-mm-txw bg-mm-gbg/30 rounded-[40px] border border-mm-crd/50">
          <span className="text-4xl mb-4 block">😔</span>

          <p className="font-medium text-mm-g">
            No se encontraron ofertas
          </p>

          <p className="text-sm mt-1">
            Prueba ajustando los filtros de búsqueda
          </p>
        </div>
      )}

      <OfferDetailModal
        offer={selectedOffer}
        onClose={() => setSelectedOffer(null)}
      />
    </div>
  );
}