import { useCallback, useEffect, useRef, useState } from 'react';
import { useMediaQuery } from '@/src/features/layout/hooks/use-media-query';

/**
 * Comparte un link: menú del sistema en el celular, portapapeles en escritorio.
 *
 * Avisa que se copió por unos segundos para que el botón pueda cambiar de ícono
 * sin necesitar un sistema de notificaciones (no hay ninguno en el repo).
 */
export function useShareLink() {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Puntero grueso = se toca con el dedo. Es una decisión de comportamiento
  // según el dispositivo, no un estilo, que es justo para lo que sirve este
  // hook. En escritorio no se abre la hoja del sistema porque ahí lo que se
  // espera de "compartir" es que copie el link.
  const esTactil = useMediaQuery('(pointer: coarse)');

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const avisarCopiado = useCallback(() => {
    setCopied(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), 2000);
  }, []);

  /**
   * Último recurso, y el único que funciona fuera de un contexto seguro.
   *
   * `navigator.clipboard` y `navigator.share` no existen en http, que es
   * exactamente como se prueba desde un celular contra el servidor de
   * desarrollo. Sin esto el botón no hacía nada y no lo decía.
   */
  const copiarALaAntigua = useCallback((url: string): boolean => {
    try {
      const campo = document.createElement('textarea');
      campo.value = url;
      campo.setAttribute('readonly', '');
      campo.style.position = 'fixed';
      campo.style.top = '0';
      campo.style.opacity = '0';
      document.body.appendChild(campo);
      campo.select();
      // iOS ignora `select()` a secas en un textarea.
      campo.setSelectionRange(0, url.length);
      const ok = document.execCommand('copy');
      document.body.removeChild(campo);
      return ok;
    } catch {
      return false;
    }
  }, []);

  const share = useCallback(
    async (url: string, title?: string) => {
      if (esTactil && typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({ title, url });
          // El propio menú es la confirmación: el ✓ sobraría.
          return;
        } catch (err) {
          // Cerrar la hoja de compartir lanza AbortError. Eso NO es un fallo:
          // copiar igualmente dejaría en el portapapeles un link que la persona
          // acaba de decidir no compartir.
          if ((err as Error)?.name === 'AbortError') return;
          // Cualquier otro error sí cae a copiar.
        }
      }

      try {
        await navigator.clipboard.writeText(url);
        avisarCopiado();
        return;
      } catch {
        // Sigue al método antiguo.
      }

      if (copiarALaAntigua(url)) avisarCopiado();
      else console.error('No se pudo compartir ni copiar el link:', url);
    },
    [esTactil, avisarCopiado, copiarALaAntigua]
  );

  return { copied, share };
}
