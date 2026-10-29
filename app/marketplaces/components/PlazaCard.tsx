import React, { useState } from 'react';
import { motion } from 'motion/react';
import { MapPin, Store as StoreIcon, Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import { useMediaQuery } from '@/features/layout/hooks/use-media-query';
import type { PublicMarketplace } from '../hooks/usePublicMarketplaces';

interface PlazaCardProps {
  plaza: PublicMarketplace;
  onOpen: () => void;
}

/**
 * Tarjeta de una plaza en el listado. Con GIF, al pasar el mouse se reproduce
 * encima de la portada; sin GIF, queda la portada.
 */
export function PlazaCard({ plaza, onOpen }: PlazaCardProps) {
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [hovering, setHovering] = useState(false);
  // El GIF se monta la primera vez que se pasa el mouse, no al abrir la página:
  // así el listado no descarga todos los GIF de entrada.
  const [gifRequested, setGifRequested] = useState(false);
  const gifUrl = reduceMotion ? null : plaza.hoverGifUrl;

  const handleEnter = () => {
    setHovering(true);
    if (gifUrl) setGifRequested(true);
  };

  return (
    <motion.div
      whileHover={{ y: -8 }}
      onClick={onOpen}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setHovering(false)}
      className="bg-white rounded-3xl border border-mm-crd shadow-sm hover:shadow-xl transition-all cursor-pointer overflow-hidden group flex flex-col"
    >
      <div className="h-40 flex items-center justify-center text-6xl group-hover:scale-105 transition-transform overflow-hidden relative bg-mm-gbg">
        {plaza.coverSignedUrl ? (
          <img src={plaza.coverSignedUrl} alt={plaza.name} className="w-full h-full object-cover" />
        ) : (
          <Building2 className="w-12 h-12 text-mm-crd" />
        )}
        {gifUrl && gifRequested && (
          <img
            src={gifUrl}
            alt=""
            aria-hidden
            className={cn(
              'absolute inset-0 w-full h-full object-cover transition-opacity duration-300',
              hovering ? 'opacity-100' : 'opacity-0'
            )}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <div className="absolute bottom-4 left-4 w-12 h-12 bg-white rounded-xl p-1 shadow-md">
          {plaza.logoSignedUrl ? (
            <img src={plaza.logoSignedUrl} alt={plaza.name} className="w-full h-full object-cover rounded-lg" />
          ) : (
            <Building2 className="w-full h-full text-mm-txw p-2" />
          )}
        </div>
      </div>

      <div className="p-6 flex-grow flex flex-col">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-xl font-bold text-mm-g font-display leading-tight">{plaza.name}</h3>
        </div>
        <div className="flex items-center gap-2 text-xs text-mm-txw mb-4">
          <MapPin className="w-3.5 h-3.5" /> {plaza.city}, {plaza.department}
        </div>

        <div className="mt-auto flex items-center justify-between pt-4 border-t border-mm-crd">
          <div className="flex items-center gap-2 text-xs font-bold text-mm-txs">
            <StoreIcon className="w-4 h-4" /> Ver tiendas
          </div>
          <Badge variant="success">Abierta</Badge>
        </div>
      </div>
    </motion.div>
  );
}
