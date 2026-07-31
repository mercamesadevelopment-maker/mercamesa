'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Topbar } from '@/src/features/layout/components/Topbar';
import { Sidebar } from '@/src/features/layout/components/Sidebar';
import { CartPanel } from '@/src/features/cart/components/CartPanel';
import { CartStoreConflictModal } from '@/src/features/cart/components/CartStoreConflictModal';
import { cn } from '@/src/components/Shared';
import { useApp } from '@/src/store';
import { useNotifications } from '@/src/features/notifications/hooks/use-notifications';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state } = useApp();
  const { fetchNotifications } = useNotifications();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const isNoLayoutPage = pathname === '/' || pathname === '/accept-invite';

  // Si la sesión se cae mientras ya estamos en una página protegida (token
  // vencido, logout desde otra pestaña), saca al usuario en vez de dejarlo
  // viendo una página "muerta" hasta la próxima navegación.
  useEffect(() => {
    if (state._hydrated && !state.isLoggedIn && !isNoLayoutPage) {
      router.replace('/');
    }
  }, [state._hydrated, state.isLoggedIn, isNoLayoutPage, router]);

  useEffect(() => {
    if (state._hydrated && (state.userRole === 'admin' || state.userRole === 'provider')) {
      fetchNotifications();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state._hydrated, state.userRole]);

  if (isNoLayoutPage) return <>{children}</>;

  return (
    <div className="min-h-screen bg-[#FAFAF5]">
      <Topbar
        onCartOpen={() => setIsCartOpen(true)}
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <Sidebar collapsed={sidebarCollapsed} />
      <main
        className={cn(
          "pt-16 min-h-screen transition-all duration-300",
          sidebarCollapsed ? "pl-20" : "pl-64"
        )}
      >
        {children}
      </main>
      <CartPanel isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      <CartStoreConflictModal />
    </div>
  );
}
