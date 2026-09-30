import './globals.css';
import { Fraunces, DM_Sans } from 'next/font/google';
import { AppProvider } from '../src/store';
import AppShell from './app-shell';

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

export const metadata = {
  title: 'MercaMesa',
  description: 'MercaMesa App',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${dmSans.variable}`}>
      <body>
        <AppProvider>
          <AppShell>
            {children}
          </AppShell>
        </AppProvider>
      </body>
    </html>
  );
}
