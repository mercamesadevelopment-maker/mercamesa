'use client';

import React from 'react';
import { SessionProvider } from '@/features/auth/session-context';
import { CartProvider } from '@/features/cart/cart-context';
import { NotificationsProvider } from '@/features/notifications/notifications-context';

/** El estado compartido de la app: la canasta depende de la sesión, por eso va adentro. */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <CartProvider>
        <NotificationsProvider>{children}</NotificationsProvider>
      </CartProvider>
    </SessionProvider>
  );
}
