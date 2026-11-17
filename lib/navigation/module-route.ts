/**
 * A dónde lleva cada módulo del menú.
 *
 * Hay módulos que no son una pantalla, solo guardan permisos: `master-catalog`
 * es el permiso de escritura del catálogo (lo exigen `app/api/products/**`) y
 * no tiene `path`. Antes el menú armaba `/${key}` para cualquier módulo sin
 * ruta, y en staging —donde `post.sql` activa todos los módulos— aparecía
 * «Catálogo maestro» llevando a `/master-catalog`, un 404.
 */

/** Rutas de los módulos viejos que no tienen `path` en la base. */
export const MODULE_KEY_ROUTES: Record<string, string> = {
  home: '/marketplaces',
  all_plazas: '/marketplaces',
  all_stores: '/stores',
  all_products: '/products',
  promotions: '/promotions',
  support: '/support',
  dashboard: '/seller/dashboard',
  products: '/seller/products',
  reputation: '/seller/settings',
  analytics: '/seller/dashboard',
  sales: '/seller/sales',
  sales_history: '/seller/sales-history',
  clients: '/seller/clients',
  admin_plazas: '/admin/marketplaces',
  admin_stores: '/admin/stores',
  admin_products: '/admin/products',
  admin_offers: '/admin/offers',
  admin_orders: '/admin/orders',
  admin_notifs: '/admin/notifications',
};

export interface MenuModule {
  id: string;
  key: string;
  path?: string | null;
  parent_id?: string | null;
}

/** La ruta del módulo, o `null` si no es una pantalla (solo permisos). */
export function moduleRoute(module: Pick<MenuModule, 'key' | 'path'>): string | null {
  const path = module.path?.trim();
  return path || MODULE_KEY_ROUTES[module.key] || null;
}

/**
 * Los módulos que el menú puede mostrar: los que tienen ruta, y los padres sin
 * ruta que tienen algún hijo visible (solo despliegan).
 */
export function visibleMenuModules<T extends MenuModule>(modules: T[]): T[] {
  const conRuta = new Set(modules.filter((m) => moduleRoute(m)).map((m) => m.id));
  const padresConHijos = new Set(
    modules.filter((m) => m.parent_id && conRuta.has(m.id)).map((m) => m.parent_id as string)
  );
  return modules.filter((m) => conRuta.has(m.id) || padresConHijos.has(m.id));
}
