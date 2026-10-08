import './globals.css';
import { Fraunces, DM_Sans } from 'next/font/google';
import { AppProvider } from '../src/store';
import AppShell from './app-shell';
import type { Metadata, Viewport } from 'next';
import { ServiceWorkerRegister } from '@/src/features/pwa/components/ServiceWorkerRegister';

/**
 * Las fuentes se sirven desde el propio sitio con `next/font`. Antes se pedían a
 * Google con un `@import url(...)` en `globals.css`, y esa línea se perdía al
 * compilar: el sitio entero se veía con las fuentes por defecto del navegador
 * (Times en los títulos).
 */
const fraunces = Fraunces({
  subsets: ['latin'],
  axes: ['opsz'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces-src',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-dm-sans-src',
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
  themeColor: '#1A3308',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${fraunces.variable} ${dmSans.variable}`}>
      <body>
        <ServiceWorkerRegister />
        <AppProvider>
          <AppShell>
            {children}
          </AppShell>
        </AppProvider>
      </body>
    </html>
  );
}
