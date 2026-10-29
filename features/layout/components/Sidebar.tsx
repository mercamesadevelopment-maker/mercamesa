'use client';

import { Sidebar as DynamicSidebar } from '@/components/ui/shell/components/Sidebar';

interface SidebarProps {
  collapsed: boolean;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ collapsed, mobileOpen, onMobileClose }: SidebarProps) {
  return (
    <DynamicSidebar
      collapsed={collapsed}
      mobileOpen={mobileOpen}
      onMobileClose={onMobileClose}
    />
  );
}
