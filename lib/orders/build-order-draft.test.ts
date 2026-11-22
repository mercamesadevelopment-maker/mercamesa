import { describe, expect, it } from 'vitest';
import { unpublishedProductIds } from './build-order-draft';

describe('unpublishedProductIds', () => {
  it('un pedido en línea solo lleva lo que muestra la vitrina', () => {
    // La auditoría de seguridad del MCP: el chat lee con el cliente de servicio,
    // que se salta la política de la base, y se podía pedir un producto de grupo
    // que la base asignó sin publicar y con precio 0.
    expect(
      unpublishedProductIds([
        { id: 'publicado', is_active: true, stores: { is_active: true } },
        { id: 'sin-publicar', is_active: false, stores: { is_active: true } },
        { id: 'tienda-inactiva', is_active: true, stores: { is_active: false } },
        { id: 'sin-tienda', is_active: true, stores: null },
      ])
    ).toEqual(['sin-publicar', 'tienda-inactiva', 'sin-tienda']);
  });
});
