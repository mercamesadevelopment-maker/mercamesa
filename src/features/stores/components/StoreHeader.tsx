'use client';

import React from 'react';
import { Store as StoreIcon, Star, Phone, MapPin, Heart, Clock } from 'lucide-react';
import { Badge, Button, cn } from '@/src/components/Shared';
import type { BusinessHours } from '@/components/ui/business-hours/business-hours-editor';
import { WeeklyHoursSummary } from '@/components/ui/business-hours/weekly-hours-summary';
import { openStatus } from '@/components/ui/business-hours/summarize-hours';
import { salesTypeLabel } from '@/lib/stores/sales-type';

/** Lo que el encabezado usa de `/api/stores/detail/[slug]`. */
export interface StoreHeaderData {
  id: string;
  name: string;
  logoSignedUrl?: string | null;
  is_active?: boolean;
  is_wholesale?: boolean;
  is_retail?: boolean;
  description?: string | null;
  phone?: string | null;
  local_address?: string | null;
  business_hours?: BusinessHours | null;
  marketplaces?: { name?: string | null } | null;
  categories?: { id: string; name: string }[];
}

interface StoreHeaderProps {
  store: StoreHeaderData;
  /** Promedio de estrellas, o `null` si nadie ha calificado todavía. */
  rating: number | null;
  reviewCount: number;
  hasMyReview: boolean;
  isLoggedIn: boolean;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onRate: () => void;
  onOpenReviews: () => void;
}

export function StoreHeader({
  store,
  rating,
  reviewCount,
  hasMyReview,
  isLoggedIn,
  isFavorite,
  onToggleFavorite,
  onRate,
  onOpenReviews,
}: StoreHeaderProps) {
  const hours =
    Array.isArray(store.business_hours) && store.business_hours.length === 7 ? store.business_hours : null;
  const status = store.is_active === false ? null : hours ? openStatus(hours) : null;
  // A quién le vende la tienda. Es un dato distinto de sus categorías: antes las
  // dos salían como la misma insignia dorada y «Minorista» nunca se mostraba.
  const salesType = salesTypeLabel(store);
  const categories = store.categories ?? [];
  const location = [store.marketplaces?.name, store.local_address?.trim()].filter(Boolean).join(' · ');

  return (
    <section className="relative bg-white rounded-[32px] border border-mm-crd shadow-sm p-6 sm:p-8 mb-10">
      {isLoggedIn && (
        <button
          onClick={onToggleFavorite}
          aria-label={isFavorite ? 'Quitar de favoritas' : 'Agregar a favoritas'}
          className="absolute top-5 right-5 p-2.5 rounded-full bg-white hover:bg-mm-gbg border border-mm-crd shadow-sm transition-all"
        >
          <Heart className={cn('w-5 h-5 transition-colors', isFavorite ? 'fill-r text-r' : 'text-mm-txw')} />
        </button>
      )}

      <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-start">
        <div className="w-24 h-24 rounded-3xl flex items-center justify-center shrink-0 overflow-hidden bg-mm-gbg border border-mm-crd/40">
          {store.logoSignedUrl ? (
            <img src={store.logoSignedUrl} alt={store.name} className="w-full h-full object-cover p-2" />
          ) : (
            <StoreIcon className="w-10 h-10 text-mm-txw" />
          )}
        </div>

        <div className="flex-grow min-w-0 text-center md:text-left md:pr-12">
          <div className="flex flex-col md:flex-row md:flex-wrap items-center gap-2 md:gap-3">
            <h1 className="text-3xl sm:text-4xl text-mm-g break-words">{store.name}</h1>
            {store.is_active === false ? (
              <Badge variant="error">No disponible</Badge>
            ) : (
              status && <Badge variant={status.isOpen ? 'success' : 'default'}>{status.label}</Badge>
            )}
          </div>

          {(location || store.phone) && (
            <div className="mt-2 flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-1 text-sm text-mm-txs">
              {location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 shrink-0" /> {location}
                </span>
              )}
              {store.phone && (
                <a href={`tel:${store.phone}`} className="flex items-center gap-1.5 hover:text-mm-g">
                  <Phone className="w-4 h-4 shrink-0" /> {store.phone}
                </a>
              )}
            </div>
          )}

          {store.description && <p className="mt-3 text-sm text-mm-txs max-w-2xl">{store.description}</p>}

          {(salesType || categories.length > 0) && (
            <div className="mt-4 flex flex-wrap items-center justify-center md:justify-start gap-2">
              {salesType && (
                <span className="px-3 py-1 rounded-full border border-mm-gl text-mm-gl text-xs font-semibold">
                  {salesType}
                </span>
              )}
              {categories.map((c) => (
                <Badge key={c.id}>{c.name}</Badge>
              ))}
            </div>
          )}

          {hours && (
            <div className="mt-4 flex items-start justify-center md:justify-start gap-2">
              <Clock className="w-4 h-4 mt-0.5 text-mm-txw shrink-0" />
              <WeeklyHoursSummary hours={hours} className="text-left" />
            </div>
          )}
        </div>

        {/* Calificación y reseñas en un solo bloque. Con cero reseñas no se
            muestra un 5.0 que nadie dio. */}
        <div className="w-full md:w-auto md:self-center shrink-0 flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-3 pt-4 md:pt-0 border-t md:border-t-0 border-mm-crd">
          <div className="text-left md:text-right">
            {rating !== null ? (
              <p className="text-2xl font-bold text-mm-oro flex items-center md:justify-end gap-1.5">
                <Star className="w-6 h-6 fill-mm-oro" /> {rating.toFixed(1)}
              </p>
            ) : (
              <p className="text-sm font-semibold text-mm-txs">Sin calificaciones aún</p>
            )}
            <button onClick={onOpenReviews} className="text-xs text-mm-txw hover:text-mm-g underline-offset-2 hover:underline">
              {reviewCount === 0 ? 'Ver reseñas' : `${reviewCount} ${reviewCount === 1 ? 'reseña' : 'reseñas'}`}
            </button>
          </div>
          {isLoggedIn && (
            <Button size="sm" variant="outline" onClick={onRate}>
              {hasMyReview ? 'Editar mi reseña' : 'Calificar'}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
