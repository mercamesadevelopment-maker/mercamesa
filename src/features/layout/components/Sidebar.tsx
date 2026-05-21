'use client';

import { Sidebar as DynamicSidebar } from '@/components/ui/shell/components/Sidebar';

interface SidebarProps {
  collapsed: boolean;
}

export function Sidebar({ collapsed }: SidebarProps) {
  return <DynamicSidebar collapsed={collapsed} />;
}
