'use client';

import { useEffect, useState } from 'react';

/**
 * Suscribe un componente a un media query de CSS y devuelve si coincide.
 * SSR-safe: arranca en `false` (asume mobile-first) y se actualiza en el
 * cliente tras montar, evitando mismatches de hidratación.
 *
 * @example
 * const isDesktop = useMediaQuery('(min-width: 1024px)');
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);

    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', listener);
    return () => mql.removeEventListener('change', listener);
  }, [query]);

  return matches;
}
