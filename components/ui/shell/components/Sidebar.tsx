import React, { useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';
import { cn } from '@/src/components/Shared';
import { useRouter, usePathname } from 'next/navigation';
import { useApp } from '@/src/store';

interface SidebarProps {
  collapsed: boolean;
}

export function Sidebar({ collapsed }: SidebarProps) {
  const { state, dispatch } = useApp();
  const router = useRouter();
  const pathname = usePathname();

  const roleId = state.buyerProfile?.role_id;
  // Pasamos _hydrated para que usePermissions sepa cuándo puede empezar a cargar
  const { modules, loading } = usePermissions(roleId, state._hydrated);
  
  const [openMenus, setOpenMenus] = useState<string[]>([]);

  const keyToRoute: Record<string, string> = {
    home: '/marketplaces',
    all_plazas: '/all-plazas',
    all_stores: '/all-stores',
    all_products: '/all-products',
    promotions: '/promotions',
    orders: '/orders',
    profile: '/profile',
    profile_ratings: '/profile',
    support: '/support',
    dashboard: '/seller/dashboard',
    products: '/seller/products',
    reputation: '/seller/reputation',
    whatsapp: '/seller/whatsapp',
    analytics: '/seller/dashboard',
    sales: '/seller/sales',
    sales_history: '/seller/sales-history',
    routes: '/delivery',
    history: '/delivery/history',
    earnings: '/delivery/earnings',
    admin_plazas: '/admin/marketplaces',
    admin_stores: '/admin/stores',
    admin_products: '/admin/products',
    admin_reputation: '/admin/reputation',
    admin_offers: '/admin/offers',
    admin_orders: '/admin/orders',
    admin_analytics: '/admin/analytics',
    admin_notifs: '/admin/notifications',
  };

  const getRoute = (key: string) => keyToRoute[key] || `/${key}`;

  const toggleMenu = (id: string) => {
    setOpenMenus(prev => 
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const renderIcon = (iconName: string | null) => {
    if (!iconName) return LucideIcons.LayoutDashboard;
    const Icon = (LucideIcons as any)[iconName];
    return Icon || LucideIcons.LayoutDashboard;
  };

  const rootModules = modules.filter(m => !m.parent_id);
  const getChildren = (parentId: string) => modules.filter(m => m.parent_id === parentId);

  return (
    <aside className={cn(
      "fixed top-16 left-0 h-[calc(100vh-64px)] bg-white border-r border-mm-crd z-50 flex flex-col transition-all duration-300",
      collapsed ? "w-20" : "w-64"
    )}>
      <div className="flex-grow py-6 px-3 space-y-2 overflow-y-auto scrollbar-hide">
        {loading ? (
          // Skeleton sutil mientras hidrata o carga permisos
          <div className="space-y-2 px-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-11 rounded-2xl bg-mm-gbg animate-pulse",
                  collapsed ? "w-11 mx-auto" : "w-full"
                )}
              />
            ))}
          </div>
        ) : rootModules.length === 0 ? (
          <div className="p-4 text-center text-sm text-mm-txw">Sin módulos asignados</div>
        ) : (
          rootModules.map(item => {
            const subItems = getChildren(item.id);
            const hasSubItems = subItems.length > 0;
            const isOpen = openMenus.includes(item.id);
            const route = item.path || getRoute(item.key);
            const isActive = pathname === route || (hasSubItems && subItems.some(s => pathname === (s.path || getRoute(s.key))));
            const Icon = renderIcon(item.icon);

            return (
              <div key={item.id} className="space-y-1">
                <button
                  onClick={() => {
                    if (hasSubItems && !collapsed) {
                      toggleMenu(item.id);
                    } else {
                      router.push(route);
                    }
                  }}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-3 rounded-2xl transition-all font-medium group relative",
                    isActive 
                      ? "bg-mm-gbg text-mm-g" 
                      : "text-mm-txs hover:bg-mm-gbg/50 hover:text-mm-g",
                    collapsed && "justify-center px-0"
                  )}
                >
                  <Icon className={cn(
                    "w-5 h-5 transition-transform group-hover:scale-110",
                    isActive ? "text-mm-g" : "text-mm-txw"
                  )} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {!collapsed && hasSubItems && (
                    <LucideIcons.ChevronDown className={cn("w-4 h-4 ml-auto transition-transform", isOpen && "rotate-180")} />
                  )}
                  {collapsed && isActive && (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-mm-g rounded-l-full" />
                  )}
                </button>

                {!collapsed && hasSubItems && isOpen && (
                  <div className="pl-9 space-y-1 overflow-hidden">
                    {subItems.map(sub => {
                      const SubIcon = renderIcon(sub.icon);
                      const subRoute = sub.path || getRoute(sub.key);
                      return (
                        <button
                          key={sub.id}
                          onClick={() => router.push(subRoute)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-sm font-medium",
                            pathname === subRoute 
                              ? "bg-mm-gll/20 text-mm-g" 
                              : "text-mm-txw hover:bg-mm-gbg/40 hover:text-mm-g"
                          )}
                        >
                          <SubIcon className="w-4 h-4" />
                          <span>{sub.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className={cn("p-4 border-t border-mm-crd transition-all", collapsed ? "px-2" : "px-4")}>
        {!collapsed ? (
          <div className="bg-mm-gbg p-3 rounded-2xl flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm shrink-0 overflow-hidden border border-mm-crd">
              <img src={state.buyerProfile?.avatar || ''} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-mm-g truncate">{state.buyerProfile?.name}</p>
              <p className="text-[10px] text-mm-txs uppercase font-bold tracking-tighter">{state.userRole}</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center mb-4">
            <div className="w-10 h-10 bg-mm-gbg rounded-xl flex items-center justify-center shadow-sm overflow-hidden border border-mm-crd">
              <img src={state.buyerProfile?.avatar || ''} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
          </div>
        )}
        <button 
          onClick={() => dispatch({ type: 'LOGOUT' })}
          title="Cerrar sesión"
          className={cn(
            "w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-r hover:bg-rl rounded-xl transition-all",
            collapsed && "px-0"
          )}
        >
          <LucideIcons.LogOut className="w-4 h-4" /> 
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  );
}