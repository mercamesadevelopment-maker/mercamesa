import { describe, expect, it } from 'vitest';
import { toProductDetail } from './product-detail';
import { toStorefrontItem, type StorefrontRow } from './storefront';

const fila: StorefrontRow = {
  id: 'p',
  store_id: 's',
  price_per_unit: 3000,
  stock: 4,
  is_featured: false,
  featured_at: null,
  product_name: 'Limón Tahití',
  product_image_url: 'imgs/c/limon.jpg',
  category_name: 'Cítricos',
  parent_category_name: 'Frutas',
  catalog_product_id: 'c',
  store_name: 'La Esquina',
  store_slug: 'la-esquina',
  marketplace_name: 'Plaza Minorista',
  unit_abbreviation: 'kg',
};

describe('toProductDetail', () => {
  it('suma la descripción, la categoría madre › hija y la tienda', () => {
    const detalle = toProductDetail(toStorefrontItem(fila, undefined), { description: '  Jugoso.  ' }, { logo_url: null });
    expect(detalle).toMatchObject({
      id: 'p',
      description: 'Jugoso.',
      categoryPath: 'Frutas › Cítricos',
      store: { id: 's', name: 'La Esquina', slug: 'la-esquina', marketplace: 'Plaza Minorista', logoUrl: null },
    });
  });

  it('sin descripción ni categoría madre, no inventa nada', () => {
    const detalle = toProductDetail(
      toStorefrontItem({ ...fila, parent_category_name: null, product_image_url: null }, undefined),
      { description: '   ' },
      null
    );
    expect(detalle.description).toBeNull();
    expect(detalle.categoryPath).toBe('Cítricos');
    expect(detalle.imageOriginalUrl).toBeNull();
  });

  it('una categoría que es su propia madre sale una sola vez', () => {
    const detalle = toProductDetail(toStorefrontItem({ ...fila, category_name: 'Frutas' }, undefined), null, null);
    expect(detalle.categoryPath).toBe('Frutas');
  });
});
