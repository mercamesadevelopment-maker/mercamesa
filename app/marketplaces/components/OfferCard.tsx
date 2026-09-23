'use client';

import { motion } from 'motion/react';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/src/components/Shared';
import { StoreOffer } from '@/src/features/offers/types/offer.types';

interface OfferCardProps {
  offer: StoreOffer;
  onClick: () => void;
  /**
   * Muestra a qué tienda pertenece la oferta.
   *
   * Solo lo usa /marketplaces: allí la sección cruza todas las plazas y no hay
   * ninguna otra señal de la tienda. /promotions tiene un desplegable para
   * filtrar por tienda, así que no lo necesita.
   */
  showStore?: boolean;
}

/**
 * Tarjeta de oferta de cara al comprador, compartida por /marketplaces y
 * /promotions. No lleva clases de ancho: el tamaño lo manda la cuadrícula del
 * padre, igual que StoreCard y ProductCard.
 */
export function OfferCard({ offer, onClick, showStore = false }: OfferCardProps) {
  const product = offer.store_products?.catalog_products;

  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="bg-white rounded-2xl sm:rounded-[32px] border border-mm-crd shadow-sm overflow-hidden flex flex-col group cursor-pointer min-w-0"
      onClick={onClick}
    >
      <div className="h-32 sm:h-48 bg-mm-gbg flex items-center justify-center text-4xl sm:text-5xl group-hover:scale-105 transition-transform overflow-hidden relative">
        {offer.imageSignedUrl ? (
          <img
            src={offer.imageSignedUrl}
            alt={product?.name || 'Oferta'}
            className="w-full h-full object-cover"
          />
        ) : (
          <span>🎁</span>
        )}

        {/* right-2: una etiqueta larga se corta con "…" en vez de salirse de la tarjeta angosta. */}
        <div className="absolute top-2 left-2 right-2 sm:top-4 sm:left-4 sm:right-4">
          <Badge
            variant="oro"
            className="inline-block max-w-full truncate align-top text-[10px] uppercase font-bold tracking-widest shadow-md"
          >
            {offer.label || 'OFERTA'}
          </Badge>
        </div>
      </div>

      <div className="p-3 sm:p-5 flex flex-col flex-grow">
        <div className="flex-grow min-w-0">
          <h3 className="text-sm sm:text-base font-bold text-mm-g leading-tight mb-1 group-hover:text-mm-oro transition-colors line-clamp-2 break-words">
            {product?.name || 'Producto en Oferta'}
          </h3>

          {showStore && (
            <p className="text-[10px] text-mm-txw font-bold uppercase tracking-tighter truncate">
              {offer.store_products?.stores?.name || 'Tienda'}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 mt-3 pt-3 sm:mt-4 sm:pt-4 border-t border-mm-gbg">
          <span className="bg-rl text-r px-2 py-0.5 sm:px-3 sm:py-1 rounded-full font-bold text-xs sm:text-sm whitespace-nowrap truncate">
            {offer.discount_pct
              ? `${offer.discount_pct}% Descuento`
              : `-$${offer.special_price?.toLocaleString('es-CO')}`}
          </span>

          <div className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 rounded-full bg-mm-g/10 flex items-center justify-center text-mm-g group-hover:bg-mm-g group-hover:text-white transition-colors">
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
