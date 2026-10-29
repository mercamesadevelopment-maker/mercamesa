import { describe, expect, it } from 'vitest';
import { ROLE_ROUTES, resolveRoleKey } from './roles';

describe('resolveRoleKey', () => {
  it('el comprador se separa por buyer_type', () => {
    expect(resolveRoleKey('buyer', 'wholesale')).toBe('wholesale');
    expect(resolveRoleKey('buyer', 'retail')).toBe('retail');
    expect(resolveRoleKey('buyer', null)).toBe('retail');
  });

  it('dueño y vendedor son la misma familia; superadmin es admin', () => {
    expect(resolveRoleKey('store_owner')).toBe('provider');
    expect(resolveRoleKey('seller')).toBe('provider');
    expect(resolveRoleKey('superadmin')).toBe('admin');
  });

  it('un rol sin pantalla propia entra como comprador', () => {
    expect(resolveRoleKey('delivery')).toBe('retail');
    expect(resolveRoleKey(null)).toBe('retail');
  });

  it('cada rol tiene a dónde ir', () => {
    expect(ROLE_ROUTES[resolveRoleKey('accountant')]).toBe('/admin/accounting');
    expect(ROLE_ROUTES[resolveRoleKey('logistics')]).toBe('/admin/orders');
  });
});
