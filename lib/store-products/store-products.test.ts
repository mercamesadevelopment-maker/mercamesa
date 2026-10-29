import { describe, expect, it } from 'vitest';
import { assignmentStoreIds, toAssignmentInsert, toStoreProductInsert } from './create';
import { toManagementItem } from './management';
import { toStorefrontItem, type StorefrontRow } from './storefront';

const ahora = new Date('2026-10-29T15:00:00Z');

describe('toStoreProductInsert', () => {
  it('los números del formulario llegan como texto y se convierten', () => {
    const fila = toStoreProductInsert(
      { store_id: 's', catalog_product_id: 'c', unit_id: 'u', price_per_unit: '1500', stock: '7', code: '  AB  12 ' },
      ahora
    );
    expect(fila).toMatchObject({ price_per_unit: 1500, stock: 7, min_order_qty: 1, code: 'AB 12', is_active: true });
    expect(fila.wholesale_price).toBeNull();
  });

  it('destacado lleva su fecha; sin destacar, ninguna', () => {
    expect(toStoreProductInsert({ is_featured: true }, ahora)).toMatchObject({ is_featured: true, featured_at: ahora.toISOString() });
    // Solo `true` destaca: un "true" de texto no.
    expect(toStoreProductInsert({ is_featured: 'true' }, ahora)).toMatchObject({ is_featured: false, featured_at: null });
  });
});

describe('asignación masiva del admin', () => {
  it('va sin código y con valores por defecto', () => {
    const fila = toAssignmentInsert({ store_id: 's', catalog_product_id: 'c', wholesale_price: '1800' });
    expect(fila).toMatchObject({ price_per_unit: 0, stock: 0, min_order_qty: 1, wholesale_price: 1800, is_active: true });
    expect(fila).not.toHaveProperty('code');
  });

  it('las tiendas: vacía o con una sin tienda es error', () => {
    expect(assignmentStoreIds([])).toEqual({ message: 'No se recibió ningún producto.' });
    expect(assignmentStoreIds([{ store_id: 'a' }, { catalog_product_id: 'c' }])).toEqual({
      message: 'Falta el store_id en algún producto.',
    });
    expect(assignmentStoreIds([{ store_id: 'a' }, { store_id: 'b' }, { store_id: 'a' }])).toEqual({ storeIds: ['a', 'b'] });
  });
});

describe('toStorefrontItem', () => {
  const fila: StorefrontRow = {
    id: 'p',
    store_id: 's',
    price_per_unit: 3000,
    stock: 4,
    is_featured: false,
    featured_at: null,
    product_name: 'Tomate',
    product_image_url: null,
    category_name: 'Verduras',
    store_name: 'La Esquina',
    store_slug: 'la-esquina',
    marketplace_name: null,
    unit_abbreviation: 'kg',
  };

  it('arma la forma anidada que pintan las tarjetas', () => {
    expect(toStorefrontItem(fila, undefined)).toMatchObject({
      price_per_unit: 3000,
      offer: null,
      imageSignedUrl: null,
      catalog_products: { name: 'Tomate', categories: { name: 'Verduras' } },
      stores: { name: 'La Esquina', slug: 'la-esquina', marketplaces: null },
      measurement_units: { abbreviation: 'kg' },
    });
  });

  it('la oferta vigente viaja aparte y el precio de lista no cambia', () => {
    const item = toStorefrontItem(fila, { listPrice: 3000, finalPrice: 2400, offerId: 'o', label: '-20%' });
    expect(item.offer).toEqual({ id: 'o', finalPrice: 2400, label: '-20%' });
    expect(item.price_per_unit).toBe(3000);
  });
});

describe('toManagementItem', () => {
  const producto = {
    id: 'p',
    catalog_products: { name: 'Tomate', image_url: null, categories: { id: 'c', name: 'Chonto', parent_id: 'v' } },
    order_items: [{ count: 3 }],
  };

  it('pone el nombre de la categoría padre y cambia el embebido por el conteo', () => {
    const item = toManagementItem(producto, new Map([['v', 'Verduras']]), true);
    expect(item.catalog_products.categories.parent).toEqual({ name: 'Verduras' });
    expect(item.order_count).toBe(3);
    expect(item).not.toHaveProperty('order_items');
  });

  it('el catálogo del admin no recibe el conteo de pedidos', () => {
    expect(toManagementItem(producto, new Map(), false)).not.toHaveProperty('order_count');
  });
});
