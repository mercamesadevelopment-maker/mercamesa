/** El rol tal como lo usa la interfaz: los compradores se separan en minorista y mayorista. */
export type RoleKey = 'retail' | 'wholesale' | 'provider' | 'runner' | 'logistics' | 'accountant' | 'admin';

/** A dónde va cada rol al iniciar sesión. */
export const ROLE_ROUTES: Record<RoleKey, string> = {
  retail: '/marketplaces',
  wholesale: '/marketplaces',
  provider: '/seller/dashboard',
  runner: '/runner',
  // Logística solo entra a las órdenes de su plaza.
  logistics: '/admin/orders',
  // El auxiliar contable solo tiene Contabilidad.
  accountant: '/admin/accounting',
  admin: '/admin/marketplaces',
};

const ROLE_KEY_BY_NAME: Record<string, RoleKey> = {
  admin: 'admin',
  superadmin: 'admin',
  seller: 'provider',
  store_owner: 'provider',
  provider: 'provider',
  runner: 'runner',
  logistics: 'logistics',
  accountant: 'accountant',
  wholesale: 'wholesale',
  retail: 'retail',
};

/**
 * `roles.name` → `RoleKey`. `buyer` se resuelve con `buyer_type`; un rol sin
 * pantalla propia (p. ej. `delivery`) entra como comprador minorista.
 */
export function resolveRoleKey(roleName: string | null | undefined, buyerType?: string | null): RoleKey {
  if (roleName === 'buyer') return buyerType === 'wholesale' ? 'wholesale' : 'retail';
  return ROLE_KEY_BY_NAME[roleName ?? ''] ?? 'retail';
}
