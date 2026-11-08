import React from 'react';
import { cn } from '@/lib/utils/cn';

export interface GridPhoto {
  id: string;
  /** URL firmada, de vida corta. */
  url: string | null;
}

/** Miniaturas de fotos privadas. Cada una abre en grande en una pestaña nueva. */
export function PhotoGrid({ photos, className }: { photos: GridPhoto[]; className?: string }) {
  // Una foto cuya URL no se pudo firmar se omite: un recuadro roto no le dice
  // nada a nadie.
  const visibles = photos.filter((p) => p.url);
  if (visibles.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {visibles.map((p, i) => (
        <a
          key={p.id}
          href={p.url!}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'block w-20 h-20 rounded-xl overflow-hidden border border-mm-crd hover:opacity-90 transition-opacity',
            className
          )}
        >
          <img src={p.url!} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
        </a>
      ))}
    </div>
  );
}
