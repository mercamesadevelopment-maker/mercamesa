import type { MetadataRoute } from 'next';

/**
 * Manifiesto de la app instalable (PWA). Next lo sirve en
 * `/manifest.webmanifest`. Los íconos salen de `scripts/generate-pwa-icons.ts`.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MercaMesa',
    short_name: 'MercaMesa',
    description: 'Compra en las plazas de mercado de tu ciudad y recibe en tu casa.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FAFAF5',
    theme_color: '#1A3308',
    lang: 'es-CO',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
