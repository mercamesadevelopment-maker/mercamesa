'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Topbar } from '@/src/features/layout/components/Topbar';
import { Sidebar } from '@/src/features/layout/components/Sidebar';
import { CartPanel } from '@/src/features/cart/components/CartPanel';
import { CartStoreConflictModal } from '@/src/features/cart/components/CartStoreConflictModal';
import { cn } from '@/src/components/Shared';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const isNoLayoutPage = pathname === '/' || pathname === '/accept-invite';

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
