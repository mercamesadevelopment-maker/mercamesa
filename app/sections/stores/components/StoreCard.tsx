'use client';

import React from 'react';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { Store as StoreIcon, Star, Heart } from 'lucide-react';
import { Badge, cn } from '@/src/components/Shared';
import { getStoreShareUrl } from '@/src/features/products/utils/share-link';
import { ShareLinkButton } from '@/src/features/products/components/ShareLinkButton';
import type { BusinessHours } from '@/components/ui/business-hours/business-hours-editor';
import { openStatus } from '@/components/ui/business-hours/summarize-hours';
import { SalesTypeLine } from '@/src/features/stores/components/SalesTypeLine';
import type { PublicStore } from '../hooks/usePublicStores';

interface StoreCardProps {
  store: PublicStore;
  isLoggedIn: boolean;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

/** Cuántas categorías caben en la tarjeta antes de resumir el resto en «+N». */
const MAX_CATEGORIES = 3;

const ACTION_BUTTON_CLASS = 'p-2 rounded-full hover:bg-mm-gbg transition-colors';

export function StoreCard({ store, isLoggedIn, isFavorite, onToggleFavorite }: StoreCardProps) {
  const router = useRouter();

  const categories = store.categories ?? [];
  const extraCategories = categories.length - MAX_CATEGORIES;

  // «Abierta» según el horario, en hora de Colombia. Antes era un texto fijo.
  const hours = store.business_hours as unknown as BusinessHours | null;
  const status = Array.isArray(hours) && hours.length === 7 ? openStatus(hours) : null;

  const reviewCount = store.reviewCount ?? 0;

  return (
    <motion.div
      whileHover={{ y: -8 }}
      onClick={() => router.push(`/stores/${store.slug}`)}
      className="bg-white rounded-3xl sm:rounded-[32px] border border-mm-crd shadow-sm hover:shadow-xl transition-all cursor-pointer p-4 sm:p-6 flex flex-col group"
    >
      {/* Logo y acciones en una fila; el nombre va debajo, a todo el ancho.
          Antes compartían la fila y, con el espacio reservado para los botones,
          al nombre le quedaban unos 56 px: «TIEND A DE…». */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-mm-gbg rounded-2xl flex items-center justify-center shrink-0 border border-mm-crd/30 overflow-hidden group-hover:scale-105 transition-transform">
          {store.logoSignedUrl ? (
            <img src={store.logoSignedUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <StoreIcon className="w-6 h-6 text-mm-txw" />
          )}
        </div>

        {/* El corazón depende de sesión (favoritos es solo para compradores
            logueados); compartir no, para que el link funcione sin entrar. */}
        <div className="flex items-center gap-1 -mr-2 -mt-1">
          <ShareLinkButton
            url={getStoreShareUrl(store.slug)}
            title={store.name}
            label="Compartir esta tienda"
            className={cn(ACTION_BUTTON_CLASS, 'text-mm-txw')}
            iconClassName="w-4.5 h-4.5"
          />

          {isLoggedIn && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite();
              }}
              aria-label={isFavorite ? 'Quitar de favoritas' : 'Agregar a favoritas'}
              className={ACTION_BUTTON_CLASS}
            >
              <Heart className={cn('w-4.5 h-4.5 transition-colors', isFavorite ? 'fill-r text-r' : 'text-mm-txw')} />
            </button>
          )}
        </div>
      </div>

      <p className="text-[10px] uppercase font-bold tracking-widest text-mm-oro truncate mb-1">
        {store.marketplaces?.name || 'Plaza'}
      </p>
      <h3 title={store.name} className="font-bold text-mm-g leading-tight line-clamp-2 break-words mb-1.5">
        {store.name}
      </h3>

      <SalesTypeLine store={store} className="mb-2.5" />

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {categories.slice(0, MAX_CATEGORIES).map((c) => (
            <Badge key={c.id}>{c.name}</Badge>
          ))}
          {extraCategories > 0 && <Badge>+{extraCategories}</Badge>}
        </div>
      )}

      <p className="text-xs text-mm-txs line-clamp-1 mb-3 sm:mb-4 flex-grow">{store.description}</p>

      <div className="pt-3 sm:pt-4 border-t border-mm-gbg flex items-center justify-between gap-2">
        {/* Solo con reseñas: `reputation_score` nace en 5.00 y todas las tiendas
            mostraban un 5.0 que nadie había dado. */}
        {reviewCount > 0 && store.rating != null ? (
          <div className="flex items-center gap-1 text-mm-oro text-xs font-bold">
            <Star className="w-4 h-4 fill-mm-oro" /> {store.rating.toFixed(1)}
            <span className="font-medium text-mm-txw">({reviewCount})</span>
          </div>
        ) : (
          <span className="text-xs text-mm-txw">Sin calificaciones</span>
        )}

        {status && (
          <span title={status.label}>
            <Badge variant={status.isOpen ? 'success' : 'default'}>{status.isOpen ? 'Abierta' : 'Cerrada'}</Badge>
          </span>
        )}
      </div>
    </motion.div>
  );
}
