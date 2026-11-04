'use client';

import { useEffect, useState } from 'react';

export type LegalLink = {
  id: string;
  kind: 'terms' | 'privacy';
  version: number;
  url: string;
};

/**
 * Los enlaces a los documentos legales vigentes.
 *
 * Se consultan sin sesión: los usa el pie de la página de inicio y la casilla
 * del registro, donde todavía no hay cuenta. Si el administrador no ha publicado
 * nada, la lista viene vacía y quien la usa muestra el texto sin enlace, en vez
 * de un enlace roto.
 */
export function useLegalLinks() {
  const [links, setLinks] = useState<LegalLink[]>([]);

  useEffect(() => {
    let vivo = true;

    fetch('/api/legal')
      .then((res) => res.json())
      .then((json) => {
        if (vivo) setLinks(json.data ?? []);
      })
      .catch(() => {
        // Un fallo acá no debe romper el formulario: simplemente no hay enlace.
      });

    return () => {
      vivo = false;
    };
  }, []);

  const buscar = (kind: LegalLink['kind']) => links.find((l) => l.kind === kind) ?? null;

  return { links, terms: buscar('terms'), privacy: buscar('privacy') };
}
