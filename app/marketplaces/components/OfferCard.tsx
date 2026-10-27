'use client';

import { useState } from 'react';
import { cn } from '@/src/components/Shared';
import { formatCOP } from '@/lib/utils/format';
import { Floating } from '@/components/ui/floating';
import { StoreOffer } from '@/src/features/offers/types/offer.types';

interface OfferCardProps {
  offer: StoreOffer;
  onClick: () => void;
  /**
   * Las pocas ofertas de la vitrina principal: su producto flota en bucle. En
   * un listado largo (/promotions) va en `false`, y la tarjeta solo entra con
   * una animación corta (ver «El producto flotando» en globals.css).
   */
  destacada?: boolean;
  /** Para alternar el color entre tarjetas vecinas. */
  index?: number;
}

/**
 * Los cuatro tonos de las tarjetas de promoción (caso de marca, lámina 16):
 * fondo de color, cifra grande y el producto sobre una media luna más oscura.
 */
const TONOS = [
  { card: 'bg-lima text-tinta', luna: 'bg-salvia', sub: 'text-tinta/70' },
  { card: 'bg-arcilla text-white', luna: 'bg-arcilla-oscura', sub: 'text-white/80' },
  { card: 'bg-salvia text-white', luna: 'bg-tinta', sub: 'text-white/80' },
  { card: 'bg-tinta text-hueso', luna: 'bg-tinta-oscura', sub: 'text-hueso/70' },
] as const;

/**
 * Tarjeta de oferta de cara al comprador, compartida por /marketplaces y
 * /promotions. No lleva clases de ancho: el tamaño lo manda la cuadrícula del
 * padre, igual que StoreCard y ProductCard.
 *
 * La foto no está recortada (los tenderos suben fotos con fondo): va en un
 * círculo sobre la media luna, que es lo que la hace «flotar».
 */
export function OfferCard({ offer, onClick, destacada = false, index = 0 }: OfferCardProps) {
  const product = offer.store_products?.catalog_products;
  const tono = TONOS[index % TONOS.length];
  // Si la foto no carga, se cae al ícono en vez de mostrar su texto alternativo
  // encima de la media luna.
  const [fotoRota, setFotoRota] = useState(false);

  const kicker = offer.label || (offer.discount_pct ? 'Descuento' : 'Precio especial');
  const cifra = offer.discount_pct ? `${offer.discount_pct}%` : formatCOP(Number(offer.special_price ?? 0));

  const foto = offer.imageSignedUrl && !fotoRota ? (
    <img
      src={offer.imageSignedUrl}
      alt={product?.name || 'Oferta'}
      loading="lazy"
      decoding="async"
      width={160}
      height={160}
      onError={() => setFotoRota(true)}
      className="mm-lift-img h-24 w-24 rounded-full object-cover shadow-xl ring-4 ring-white/40 sm:h-32 sm:w-32"
    />
  ) : (
    <span className="flex h-24 w-24 items-center justify-center rounded-full bg-white/30 text-4xl sm:h-32 sm:w-32">🎁</span>
  );

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'mm-rise mm-lift relative flex min-w-0 flex-col overflow-hidden rounded-[28px] text-left',
        'min-h-64 sm:min-h-80 shadow-[0_14px_30px_-18px_rgba(14,59,47,0.5)]',
        tono.card
      )}
    >
      <div className="relative z-10 p-4 sm:p-5">
        <p className="truncate text-xs font-semibold sm:text-sm">{kicker}</p>
        <p className="text-3xl font-extrabold leading-none tracking-[-0.04em] sm:text-5xl">{cifra}</p>
        <p className={cn('mt-1.5 line-clamp-2 text-xs sm:text-sm', tono.sub)}>{product?.name || 'Producto en oferta'}</p>
        {/* Siempre, también en /promotions: el filtro por tienda de esa página
            no le dice al comprador de qué tienda es cada oferta cuando ve
            todas a la vez. */}
        <p className={cn('truncate font-mono text-[10px] uppercase tracking-widest', tono.sub)}>
          {offer.store_products?.stores?.name || 'Tienda'}
        </p>
      </div>

      {/* La media luna y el producto encima. */}
      <div className="relative mt-auto flex h-28 items-end justify-center sm:h-40">
        <div
          aria-hidden
          className={cn('absolute inset-x-0 bottom-0 h-3/5', tono.luna)}
          style={{ borderTopLeftRadius: '50% 70%', borderTopRightRadius: '50% 70%' }}
        />
        <div className="relative mb-4 sm:mb-6">
          {destacada ? (
            <Floating shadow={false} delay={index * 1.3}>
              {foto}
            </Floating>
          ) : (
            foto
          )}
        </div>
      </div>
    </button>
  );
}
