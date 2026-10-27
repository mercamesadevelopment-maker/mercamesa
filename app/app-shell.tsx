'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Topbar } from '@/src/features/layout/components/Topbar';
import { Sidebar } from '@/src/features/layout/components/Sidebar';
import { CartPanel } from '@/src/features/cart/components/CartPanel';
import { CartStoreConflictModal } from '@/src/features/cart/components/CartStoreConflictModal';
import { cn } from '@/src/components/Shared';
import { useSession } from '@/src/features/auth/session-context';
import { useNotifications } from '@/src/features/notifications/hooks/use-notifications';
import { useMediaQuery } from '@/src/features/layout/hooks/use-media-query';
import { LegalGate } from '@/src/features/legal/components/LegalGate';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();
  const { fetchNotifications } = useNotifications();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const isNoLayoutPage = pathname === '/' || pathname === '/accept-invite';

  // Evita que el drawer móvil quede abierto tras navegar a otra ruta.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  // Si la sesión se cae mientras ya estamos en una página protegida (token
  // vencido, logout desde otra pestaña), saca al usuario en vez de dejarlo
  // viendo una página "muerta" hasta la próxima navegación.
  useEffect(() => {
    if (session.hydrated && !session.isLoggedIn && !isNoLayoutPage) {
      router.replace('/');
    }
  }, [session.hydrated, session.isLoggedIn, isNoLayoutPage, router]);

  useEffect(() => {
    if (session.hydrated && ['admin', 'provider', 'runner', 'logistics', 'accountant'].includes(session.role)) {
      fetchNotifications();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.hydrated, session.role]);

  if (isNoLayoutPage) return <>{children}</>;

  return (
    <div className="min-h-screen bg-[#F7F5EE]">
      <Topbar
        onCartOpen={() => setIsCartOpen(true)}
        onToggleSidebar={() =>
          isDesktop ? setSidebarCollapsed(v => !v) : setMobileNavOpen(v => !v)
        }
      />
      <Sidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />
      <main
        className={cn(
          "pt-16 min-h-screen pl-0 transition-all duration-300",
          sidebarCollapsed ? "lg:pl-20" : "lg:pl-64"
        )}
      >
        {children}
      </main>
      <CartPanel isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      <CartStoreConflictModal />

      {/* Si se publicó una versión nueva de los términos o de la política de
          datos, no se sigue hasta aceptarla. Se monta acá porque este shell ya
          envuelve todo lo que exige sesión, y ya espera a que el estado esté
          hidratado. */}
      <LegalGate enabled={session.hydrated && session.isLoggedIn} />
    </div>
  );
}
