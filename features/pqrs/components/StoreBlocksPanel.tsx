'use client';

import React from 'react';
import { Disclosure } from '@/components/ui/disclosure/Disclosure';
import { fechaCorta } from '@/lib/dates/relative-time';
import { useStoreBlocks } from '../hooks/use-store-blocks';

/**
 * Los compradores que no pueden comprar en la tienda. Solo aparece si hay
 * alguno: para la mayoría de tiendas esto no existe.
 */
export function StoreBlocksPanel({ storeId }: { storeId: string | null | undefined }) {
  const blocks = useStoreBlocks(storeId);
  if (blocks.length === 0) return null;

  return (
    <div className="bg-white rounded-3xl border border-mm-crd p-4 sm:p-5 mb-4 text-sm">
      <Disclosure label={`Compradores bloqueados en tu tienda (${blocks.length})`}>
        <ul className="divide-y divide-mm-crd/60 mt-3">
          {blocks.map((b) => (
            <li key={b.id} className="py-2.5">
              <p className="font-bold text-mm-g break-words">{b.buyerName ?? 'Comprador'}</p>
              <p className="text-xs text-mm-txw">
                Desde el {fechaCorta(b.createdAt)}
                {b.pqrsCode && ` · ${b.pqrsCode}`}
              </p>
            </li>
          ))}
        </ul>
        <p className="text-xs text-mm-txw mt-2">
          Para levantar un bloqueo, escribe en el caso con el que lo pediste.
        </p>
      </Disclosure>
    </div>
  );
}
