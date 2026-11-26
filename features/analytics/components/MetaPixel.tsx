'use client';

import { useEffect, useRef } from 'react';
import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { getMetaPixelId } from '@/lib/env';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/**
 * El píxel de Meta: el código que entrega Meta, cargado con `next/script` para
 * no frenar la página.
 *
 * Ese código cuenta una visita solo cuando la página carga desde cero. En la app
 * cambiar de pantalla no recarga la página, así que la visita de cada pantalla
 * siguiente se cuenta acá, al cambiar la ruta.
 *
 * Sin `NEXT_PUBLIC_META_PIXEL_ID` (staging y local) no se carga nada.
 */
export function MetaPixel() {
  const pixelId = getMetaPixelId();
  const pathname = usePathname();
  const primera = useRef(true);

  useEffect(() => {
    if (!pixelId) return;
    // La primera visita la cuenta el propio código de Meta al cargar.
    if (primera.current) {
      primera.current = false;
      return;
    }
    window.fbq?.('track', 'PageView');
  }, [pathname, pixelId]);

  if (!pixelId) return null;

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId}');
fbq('track', 'PageView');`}
      </Script>
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          alt=""
          src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
