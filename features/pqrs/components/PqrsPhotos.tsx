import React from 'react';
import type { PqrsAttachment } from '@/lib/pqrs/types';

/** Las fotos de un caso o de un mensaje. Cada una abre en una pestaña nueva. */
export function PqrsPhotos({ attachments }: { attachments: PqrsAttachment[] }) {
  // Una foto cuya URL no se pudo firmar se omite: un recuadro roto no le dice
  // nada a nadie.
  const visibles = attachments.filter((a) => a.url);
  if (visibles.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {visibles.map((a, i) => (
        <a
          key={a.id}
          href={a.url!}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-20 h-20 rounded-xl overflow-hidden border border-mm-crd hover:opacity-90 transition-opacity"
        >
          <img src={a.url!} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
        </a>
      ))}
    </div>
  );
}
