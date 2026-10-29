'use client';

import { useEffect, useState } from 'react';
import { pqrsService, type StoreBlock } from '../services/pqrs.service';

/** Los compradores bloqueados en una tienda. */
export function useStoreBlocks(storeId: string | null | undefined) {
  const [blocks, setBlocks] = useState<StoreBlock[]>([]);

  useEffect(() => {
    setBlocks([]);
    if (!storeId) return;

    let vigente = true;
    pqrsService
      .storeBlocks(storeId)
      .then((data) => vigente && setBlocks(data))
      // Es un panel informativo: si falla no se muestra, y el resto de la
      // página sigue sirviendo.
      .catch(() => undefined);

    return () => {
      vigente = false;
    };
  }, [storeId]);

  return blocks;
}
