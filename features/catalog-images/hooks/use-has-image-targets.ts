'use client';

import { useEffect, useState } from 'react';
import { fetchImageTargets } from '../services/catalog-images.service';

/**
 * ¿La tienda tiene productos a los que les puede poner foto (los de su grupo o
 * los que propuso)? Si no, el botón de cargar imágenes no tiene nada que hacer.
 */
export function useHasImageTargets(storeId?: string): boolean {
  const [has, setHas] = useState(false);

  useEffect(() => {
    if (!storeId) {
      setHas(false);
      return;
    }
    let vigente = true;
    fetchImageTargets(storeId)
      .then((list) => vigente && setHas(list.length > 0))
      .catch(() => vigente && setHas(false));
    return () => {
      vigente = false;
    };
  }, [storeId]);

  return has;
}
