import { describe, expect, it } from 'vitest';
import { canEditCatalogImage, type CatalogImageActor } from './access';
import { isCatalogImagePathFor } from './files';

const producto = (ownerGroupId: string | null, reviewStatus = 'approved', proposedByStoreId: string | null = null) => ({
  ownerGroupId,
  reviewStatus,
  proposedByStoreId,
});
const admin: CatalogImageActor = { kind: 'admin' };
const tienda: CatalogImageActor = { kind: 'store', storeId: 'tienda-a', groupId: 'grupo-1' };
const sinGrupo: CatalogImageActor = { kind: 'store', storeId: 'tienda-b', groupId: null };

describe('canEditCatalogImage', () => {
  it('el admin, con cualquier producto', () => {
    expect(canEditCatalogImage(producto(null), admin)).toBe(true);
    expect(canEditCatalogImage(producto('grupo-2'), admin)).toBe(true);
  });

  it('la tienda, con los productos de su grupo', () => {
    expect(canEditCatalogImage(producto('grupo-1'), tienda)).toBe(true);
  });

  it('la tienda no toca el catálogo público ni otro grupo', () => {
    expect(canEditCatalogImage(producto(null), tienda)).toBe(false);
    expect(canEditCatalogImage(producto('grupo-2'), tienda)).toBe(false);
    expect(canEditCatalogImage(producto(null), sinGrupo)).toBe(false);
  });

  it('un producto en revisión: solo la tienda que lo propuso', () => {
    expect(canEditCatalogImage(producto(null, 'pending', 'tienda-b'), sinGrupo)).toBe(true);
    expect(canEditCatalogImage(producto(null, 'pending', 'tienda-b'), tienda)).toBe(false);
    // Aunque sea de su grupo: lo propuso otra y está en revisión.
    expect(canEditCatalogImage(producto('grupo-1', 'pending', 'tienda-b'), tienda)).toBe(false);
  });
});

describe('isCatalogImagePathFor', () => {
  it('acepta solo una foto de ese producto', () => {
    expect(isCatalogImagePathFor('p1', 'imgs/p1/img-123.jpg')).toBe(true);
    expect(isCatalogImagePathFor('p1', 'imgs/p2/img-123.jpg')).toBe(false);
    expect(isCatalogImagePathFor('p1', 'imgs/p1/../p2/img-1.jpg')).toBe(false);
    expect(isCatalogImagePathFor('p1', 'imgs/p1/img-1/otra.jpg')).toBe(false);
    expect(isCatalogImagePathFor('p1', 'imgs/p1/img-1.svg')).toBe(false);
    expect(isCatalogImagePathFor('p1', 42)).toBe(false);
  });
});
