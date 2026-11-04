import './globals.css';
import { Poppins, JetBrains_Mono } from 'next/font/google';
import { AppProviders } from './providers';
import AppShell from './app-shell';
import type { Metadata, Viewport } from 'next';
import { ServiceWorkerRegister } from '@/features/pwa/components/ServiceWorkerRegister';

/**
 * Las fuentes se sirven desde el propio sitio con `next/font`. Antes se pedían a
 * Google con un `@import url(...)` en `globals.css`, y esa línea se perdía al
 * compilar: el sitio entero se veía con las fuentes por defecto del navegador
 * (Times en los títulos).
 */
const poppins = Poppins({
  subsets: ['latin'],
  // 400 cuerpo, 600 nombres y botones, 800 titulares y precios (marca).
  weight: ['400', '500', '600', '700', '800'],
  // Sin itálica: `next/font` precarga cada variante declarada y la itálica casi
  // no se usa; donde aparece, el navegador la inclina.
  style: ['normal'],
  variable: '--font-poppins-src',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains-src',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'MercaMesa',
  description: 'MercaMesa App',
  // App instalable: el manifiesto lo sirve `app/manifest.ts`.
  manifest: '/manifest.webmanifest',
  applicationName: 'MercaMesa',
  appleWebApp: {
    capable: true,
    title: 'MercaMesa',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#0E3B2F',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${poppins.variable} ${jetbrains.variable}`}>
      <body>
        <ServiceWorkerRegister />
        <AppProviders>
          <AppShell>
            {children}
          </AppShell>
        </AppProviders>
      </body>
    </html>
  );
}
