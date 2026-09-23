import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Copia un link al portapapeles y avisa que se copió por unos segundos, para
 * que el botón de compartir pueda cambiar de ícono sin necesitar un sistema de
 * notificaciones (no hay ninguno en el repo).
 */
export function useCopyLink() {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const copy = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // navigator.clipboard puede fallar en http o sin permiso; no hay nada más
      // que ofrecer sin un sistema de notificaciones, así que se registra y ya.
      console.error('No se pudo copiar el link:', err);
    }
  }, []);

  return { copied, copy };
}
