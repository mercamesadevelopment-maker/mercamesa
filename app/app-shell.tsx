'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Topbar, CartPanel } from '../src/components/Shell';
import { Sidebar } from '../components/ui/shell/components/Sidebar';
import { cn } from '../src/components/Shared';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const isLanding = pathname === '/';

  if (isLanding) return <>{children}</>;

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
    </div>
  );
}
