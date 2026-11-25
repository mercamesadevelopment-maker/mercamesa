'use client';

import React from 'react';
import { SessionProvider } from '@/features/auth/session-context';
import { CartProvider } from '@/features/cart/cart-context';
import { CartPanelProvider } from '@/features/cart/cart-panel-context';
import { NotificationsProvider } from '@/features/notifications/notifications-context';
import { ActiveOrdersProvider } from '@/features/orders/active-orders-context';

/**
 * El estado compartido de la app: la canasta y los pedidos en curso dependen de la
 * sesión, por eso van adentro.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <CartProvider>
        <CartPanelProvider>
          <NotificationsProvider>
            <ActiveOrdersProvider>{children}</ActiveOrdersProvider>
          </NotificationsProvider>
        </CartPanelProvider>
      </CartProvider>
    </SessionProvider>
  );
}
