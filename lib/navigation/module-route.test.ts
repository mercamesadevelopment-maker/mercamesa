import { describe, expect, it } from 'vitest';
import { moduleRoute, visibleMenuModules } from './module-route';

describe('moduleRoute', () => {
  it('un módulo de solo permisos no tiene ruta (antes daba /master-catalog, un 404)', () => {
    expect(moduleRoute({ key: 'master-catalog', path: null })).toBeNull();
  });

  it('usa el path de la base', () => {
    expect(moduleRoute({ key: 'catalog', path: '/admin/catalog' })).toBe('/admin/catalog');
  });

  it('o la ruta conocida de la llave', () => {
    expect(moduleRoute({ key: 'admin_orders', path: null })).toBe('/admin/orders');
  });
});

describe('visibleMenuModules', () => {
  it('deja fuera los de solo permisos y conserva los padres con hijos visibles', () => {
    const modulos = [
      { id: '1', key: 'master-catalog', path: null, parent_id: null },
      { id: '2', key: 'secciones', path: null, parent_id: null },
      { id: '3', key: 'catalog', path: '/admin/catalog', parent_id: '2' },
      { id: '4', key: 'vacio', path: null, parent_id: null },
      { id: '5', key: 'sin-ruta', path: '', parent_id: '4' },
    ];
    expect(visibleMenuModules(modulos).map((m) => m.key)).toEqual(['secciones', 'catalog']);
  });
});
