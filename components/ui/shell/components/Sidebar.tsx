import React, { useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';
import { cn } from '@/src/components/Shared';
import { useRouter, usePathname } from 'next/navigation';
import { useApp } from '@/src/store';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useMediaQuery } from '@/src/features/layout/hooks/use-media-query';

interface SidebarProps {
  collapsed: boolean;
  /** Controla el drawer en viewports < lg. Ignorado en desktop. */
  mobileOpen?: boolean;
  /** Se invoca al navegar, cerrar sesión o tocar el backdrop en móvil. */
  onMobileClose?: () => void;
}

export function Sidebar({
  collapsed,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const { state } = useApp();

  const router = useRouter();

  const pathname = usePathname();

  // < lg: el Sidebar es un drawer a todo el ancho que se despliega desde
  // debajo del Topbar, no el riel colapsable de desktop — por eso el prop
  // `collapsed` (que refleja preferencia de desktop) se ignora ahí.
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const effectiveCollapsed = isDesktop && collapsed;

  const roleId = state.buyerProfile?.role_id;

  const { modules, loading } =
    usePermissions(
      roleId,
      state._hydrated
    );

  const [openMenus, setOpenMenus] =
    useState<string[]>([]);

  const keyToRoute: Record<
    string,
    string
  > = {
    home: '/marketplaces',
    all_plazas: '/sections/marketplaces',
    all_stores: '/sections/stores',
    all_products: '/sections/products',
    promotions: '/promotions',
    orders: '/orders',
    profile: '/profile',
    profile_ratings: '/profile',
    profile_account: '/profile',
    support: '/support',
    dashboard: '/seller/dashboard',
    products: '/seller/products',
    reputation: '/seller/settings',
    whatsapp: '/seller/whatsapp',
    analytics: '/seller/dashboard',
    sales: '/seller/sales',
    sales_history:
      '/seller/sales-history',
    clients: '/seller/clients',
    routes: '/delivery',
    history: '/delivery/history',
    earnings: '/delivery/earnings',
    admin_plazas:
      '/admin/marketplaces',
    admin_stores: '/admin/stores',
    admin_products:
      '/admin/products',
    admin_reputation:
      '/admin/reputation',
    admin_offers: '/admin/offers',
    admin_orders: '/admin/orders',
    admin_analytics:
      '/admin/analytics',
    admin_notifs:
      '/admin/notifications',
  };

  const getRoute = (key: string) =>
    keyToRoute[key] || `/${key}`;

  const toggleMenu = (id: string) => {
    setOpenMenus(prev =>
      prev.includes(id)
        ? prev.filter(m => m !== id)
        : [...prev, id]
    );
  };

  const navigateTo = (route: string) => {
    router.push(route);
    onMobileClose?.();
  };

  const renderIcon = (
    iconName: string | null
  ) => {
    if (!iconName)
      return LucideIcons.LayoutDashboard;

    const Icon = (LucideIcons as any)[
      iconName
    ];

    return (
      Icon ||
      LucideIcons.LayoutDashboard
    );
  };

  const rootModules = modules.filter(
    m => !m.parent_id
  );

  const getChildren = (
    parentId: string
  ) =>
    modules.filter(
      m => m.parent_id === parentId
    );

  const avatar =
    state.buyerProfile?.avatar?.trim();

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 top-16 z-40 bg-black/40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-16 z-50 flex flex-col bg-white border-mm-crd transition-all duration-300',
          'w-full h-[calc(100vh-64px)] border-b shadow-xl',
          'lg:h-[calc(100vh-64px)] lg:border-r lg:border-b-0 lg:shadow-none',
          effectiveCollapsed ? 'lg:w-20' : 'lg:w-64',
          isDesktop || mobileOpen ? 'translate-y-0' : '-translate-y-full'
        )}
      >
      <div className="flex-grow py-6 px-3 space-y-2 overflow-y-auto scrollbar-hide">
        {loading ? (
          <div className="space-y-2 px-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-11 rounded-2xl bg-mm-gbg animate-pulse',
                  effectiveCollapsed
                    ? 'w-11 mx-auto'
                    : 'w-full'
                )}
              />
            ))}
          </div>
        ) : rootModules.length === 0 ? (
          <div className="p-4 text-center text-sm text-mm-txw">
            Sin módulos asignados
          </div>
        ) : (
          rootModules.map(item => {
            const subItems = getChildren(
              item.id
            );

            const hasSubItems =
              subItems.length > 0;

            const isOpen =
              openMenus.includes(item.id);

            const route =
              item.path ||
              getRoute(item.key);

            const isActive =
              pathname === route ||
              (hasSubItems &&
                subItems.some(
                  s =>
                    pathname ===
                    (s.path ||
                      getRoute(s.key))
                ));

            const Icon = renderIcon(
              item.icon
            );

            return (
              <div
                key={item.id}
                className="space-y-1"
              >
                <button
                  onClick={() => {
                    if (
                      hasSubItems &&
                      !effectiveCollapsed
                    ) {
                      toggleMenu(item.id);
                    } else {
                      navigateTo(route);
                    }
                  }}
                  title={
                    effectiveCollapsed
                      ? item.label
                      : undefined
                  }
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-3 rounded-2xl transition-all font-medium group relative',
                    isActive
                      ? 'bg-mm-gbg text-mm-g'
                      : 'text-mm-txs hover:bg-mm-gbg/50 hover:text-mm-g',
                    effectiveCollapsed &&
                      'justify-center px-0'
                  )}
                >
                  <Icon
                    className={cn(
                      'w-5 h-5 transition-transform group-hover:scale-110',
                      isActive
                        ? 'text-mm-g'
                        : 'text-mm-txw'
                    )}
                  />

                  {!effectiveCollapsed && (
                    <span className="truncate">
                      {item.label}
                    </span>
                  )}

                  {!effectiveCollapsed &&
                    hasSubItems && (
                      <LucideIcons.ChevronDown
                        className={cn(
                          'w-4 h-4 ml-auto transition-transform',
                          isOpen &&
                            'rotate-180'
                        )}
                      />
                    )}

                  {effectiveCollapsed &&
                    isActive && (
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-mm-g rounded-l-full" />
                    )}
                </button>

                {!effectiveCollapsed &&
                  hasSubItems &&
                  isOpen && (
                    <div className="pl-9 space-y-1 overflow-hidden">
                      {subItems.map(
                        sub => {
                          const SubIcon =
                            renderIcon(
                              sub.icon
                            );

                          const subRoute =
                            sub.path ||
                            getRoute(
                              sub.key
                            );

                          return (
                            <button
                              key={sub.id}
                              onClick={() =>
                                navigateTo(
                                  subRoute
                                )
                              }
                              className={cn(
                                'w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-sm font-medium',
                                pathname ===
                                  subRoute
                                  ? 'bg-mm-gll/20 text-mm-g'
                                  : 'text-mm-txw hover:bg-mm-gbg/40 hover:text-mm-g'
                              )}
                            >
                              <SubIcon className="w-4 h-4" />

                              <span>
                                {sub.label}
                              </span>
                            </button>
                          );
                        }
                      )}
                    </div>
                  )}
              </div>
            );
          })
        )}
      </div>

      <div
        className={cn(
          'p-4 border-t border-mm-crd transition-all',
          effectiveCollapsed ? 'px-2' : 'px-4'
        )}
      >
        {!effectiveCollapsed ? (
          <div className="bg-mm-gbg p-3 rounded-2xl flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm shrink-0 overflow-hidden border border-mm-crd">
              {avatar ? (
                <img
                  src={avatar}
                  alt="Profile"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <LucideIcons.User className="w-5 h-5 text-mm-txw" />
              )}
            </div>

            <div className="overflow-hidden">
              <p className="text-sm font-bold text-mm-g truncate">
                {
                  state.buyerProfile
                    ?.name
                }
              </p>

              <p className="text-[10px] text-mm-txs uppercase font-bold tracking-tighter">
                {state.userRole}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center mb-4">
            <div className="w-10 h-10 bg-mm-gbg rounded-xl flex items-center justify-center shadow-sm overflow-hidden border border-mm-crd">
              {avatar ? (
                <img
                  src={avatar}
                  alt="Profile"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <LucideIcons.User className="w-5 h-5 text-mm-txw" />
              )}
            </div>
          </div>
        )}

        <button
          onClick={async () => {
            const supabase =
              createSupabaseBrowserClient();

            await supabase.auth.signOut();

            onMobileClose?.();
            router.push('/');
          }}
          title="Cerrar sesión"
          className={cn(
            'w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-r hover:bg-rl rounded-xl transition-all',
            effectiveCollapsed && 'px-0'
          )}
        >
          <LucideIcons.LogOut className="w-4 h-4" />

          {!effectiveCollapsed && (
            <span>
              Cerrar sesión
            </span>
          )}
        </button>
      </div>
      </aside>
    </>
  );
}
