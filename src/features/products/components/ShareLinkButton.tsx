'use client';

import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Share2, Check } from 'lucide-react';
import { cn } from '@/src/components/Shared';
import { useShareLink } from '@/src/features/products/hooks/use-share-link';

interface ShareLinkButtonProps {
  url: string;
  /** Lo que se comparte: el nombre de la tienda o del producto. */
  title?: string;
  /** Texto accesible y de ayuda: «Compartir esta tienda». */
  label: string;
  /** Estilo del botón, que cambia de una tarjeta a otra. */
  className?: string;
  /** Dónde va el conjunto dentro de la tarjeta (p. ej. flotando en una esquina). */
  wrapperClassName?: string;
  iconClassName?: string;
}

/**
 * El botón de compartir de las tarjetas, con su aviso.
 *
 * En escritorio «compartir» copia el link, y antes lo único que lo decía era el
 * ícono cambiando a un ✓ por dos segundos: fácil de no ver. Ahora además sale
 * una burbuja «Link copiado» pegada al botón.
 *
 * En el celular no aparece: `useShareLink` abre el menú del sistema y no marca
 * `copied`, porque ahí el propio menú es la confirmación.
 */
export function ShareLinkButton({
  url,
  title,
  label,
  className,
  wrapperClassName,
  iconClassName = 'w-4 h-4',
}: ShareLinkButtonProps) {
  const { copied, share } = useShareLink();

  const handleClick = (e: React.MouseEvent) => {
    // Las tarjetas navegan al hacer clic; compartir no debe abrirlas.
    e.stopPropagation();
    share(url, title);
  };

  return (
    <span className={cn('relative inline-flex', wrapperClassName)}>
      <button onClick={handleClick} aria-label={label} title={label} className={className}>
        {copied ? (
          <Check className={cn(iconClassName, 'text-mm-g')} />
        ) : (
          <Share2 className={iconClassName} />
        )}
      </button>

      <AnimatePresence>
        {copied && (
          <motion.span
            role="status"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            // Debajo del botón y alineada a su derecha: los botones de compartir
            // van en la esquina derecha de la tarjeta, y hacia ese lado no cabe.
            className="pointer-events-none absolute right-0 top-full z-20 mt-1.5 whitespace-nowrap rounded-full bg-mm-g px-3 py-1 text-xs font-semibold text-white shadow-lg"
          >
            Link copiado
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
