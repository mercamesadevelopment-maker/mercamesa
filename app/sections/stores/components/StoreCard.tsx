'use client';

import React from 'react';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { Store as StoreIcon, Star, Heart, Share2, Check } from 'lucide-react';
import { Badge, cn } from '@/src/components/Shared';
import { getStoreShareUrl } from '@/src/features/products/utils/share-link';
import { useCopyLink } from '@/src/features/products/hooks/use-copy-link';
import type { PublicStore } from '../hooks/usePublicStores';

interface StoreCardProps {
  store: PublicStore;
  isLoggedIn: boolean;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

export function StoreCard({ store, isLoggedIn, isFavorite, onToggleFavorite }: StoreCardProps) {
  const router = useRouter();
  const { copied, copy } = useCopyLink();

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    copy(getStoreShareUrl(store.slug));
  };

  return (
    <motion.div
      whileHover={{ y: -8 }}
      onClick={() => router.push(`/stores/${store.slug}`)}
      className="relative bg-white rounded-3xl sm:rounded-[32px] border border-mm-crd shadow-sm hover:shadow-xl transition-all cursor-pointer p-4 sm:p-6 flex flex-col group"
    >
      {/* El corazón depende de sesión (favoritos es solo para compradores
          logueados, y esta página ya exige sesión de todos modos); compartir no,
          para que el link funcione tal como se ve acá. */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 flex items-center gap-2">
        <button
          onClick={handleShare}
          aria-label="Copiar link de la tienda"
          title="Copiar link de la tienda"
          className="p-2.5 rounded-full bg-white/90 hover:bg-white shadow-sm transition-all"
        >
          {copied ? <Check className="w-4.5 h-4.5 text-mm-g" /> : <Share2 className="w-4.5 h-4.5 text-mm-txw" />}
        </button>

        {isLoggedIn && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            aria-label={isFavorite ? 'Quitar de favoritas' : 'Agregar a favoritas'}
            className="p-2.5 rounded-full bg-white/90 hover:bg-white shadow-sm transition-all"
          >
            <Heart
              className={cn(
                'w-4.5 h-4.5 transition-colors',
                isFavorite ? 'fill-r text-r' : 'text-mm-txw'
              )}
            />
          </button>
        )}
      </div>

      {/* Se reserva espacio a la derecha para que estos botones no tapen el
          nombre: uno o dos íconos según haya sesión. */}
      <div className={cn('flex items-start gap-3 sm:gap-4 mb-3 sm:mb-4', isLoggedIn ? 'pr-20' : 'pr-10')}>
        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-mm-gbg rounded-2xl flex items-center justify-center shrink-0 border border-mm-crd/30 overflow-hidden group-hover:scale-105 transition-transform">
          {store.logoSignedUrl ? (
            <img src={store.logoSignedUrl} alt={store.name} className="w-full h-full object-cover" />
          ) : (
            <StoreIcon className="w-6 h-6 text-mm-txw" />
          )}
        </div>
        <div className="flex-grow min-w-0">
          <Badge variant="oro" className="mb-1 text-[10px] uppercase font-bold tracking-widest block truncate">
            {store.marketplaces?.name || 'Plaza'}
          </Badge>
          <h3 className="font-bold text-mm-g leading-tight line-clamp-2 break-words">{store.name}</h3>
        </div>
      </div>

      <p className="text-xs text-mm-txs line-clamp-2 mb-3 sm:mb-4 flex-grow">{store.description}</p>

      <div className="pt-3 sm:pt-4 border-t border-mm-gbg flex items-center justify-between">
        <div className="flex items-center gap-1 text-mm-oro text-xs font-bold">
          <Star className="w-4 h-4 fill-mm-oro" /> {(store.reputation_score || 5.0).toFixed(1)}
        </div>
        <Badge variant="success">Abierta</Badge>
      </div>
    </motion.div>
  );
}
