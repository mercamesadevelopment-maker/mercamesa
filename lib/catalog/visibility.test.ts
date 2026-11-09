import { describe, expect, it } from 'vitest';
import { canStoreUseCatalogProduct, catalogDenialMessage, catalogDenialReason, EXCLUSIVE_PRODUCT_MESSAGE } from './visibility';

const aprobado = { reviewStatus: 'approved', proposedByStoreId: null };

describe('catalogDenialReason', () => {
  it('un producto público lo publica cualquier tienda', () => {
    expect(catalogDenialReason({ ...aprobado, ownerGroupId: null }, { id: 't', groupId: null })).toBeNull();
  });

  it('uno exclusivo solo lo publica una tienda de su grupo', () => {
    const producto = { ...aprobado, ownerGroupId: 'g1' };
    expect(catalogDenialReason(producto, { id: 't', groupId: 'g1' })).toBeNull();
    expect(catalogDenialReason(producto, { id: 't', groupId: 'g2' })).toBe('other_group');
  });

  // Regresión: «Protector labial Coco» era del grupo «Decorarte», pero la tienda
  // Decorarte no estaba en ningún grupo. Se rechaza, con razón: lo que estaba
  // mal es el mensaje, que decía «de otra tienda».
  it('una tienda sin grupo no publica lo exclusivo, aunque el grupo lleve su nombre', () => {
    expect(catalogDenialReason({ ...aprobado, ownerGroupId: 'decorarte' }, { id: 't', groupId: null })).toBe('other_group');
  });

  it('uno en revisión solo lo publica la tienda que lo propuso', () => {
    const producto = { reviewStatus: 'pending', proposedByStoreId: 't1', ownerGroupId: null };
    expect(catalogDenialReason(producto, { id: 't1', groupId: null })).toBeNull();
    expect(catalogDenialReason(producto, { id: 't2', groupId: null })).toBe('in_review');
  });

  it('canStoreUseCatalogProduct dice lo mismo como sí o no', () => {
    expect(canStoreUseCatalogProduct({ ...aprobado, ownerGroupId: 'g1' }, { id: 't', groupId: null })).toBe(false);
    expect(canStoreUseCatalogProduct({ ...aprobado, ownerGroupId: null }, { id: 't', groupId: null })).toBe(true);
  });
});

describe('catalogDenialMessage', () => {
  it('nombra el grupo dueño y la tienda que no está en él', () => {
    const mensaje = catalogDenialMessage({
      reason: 'other_group',
      storeName: 'Decorarte Velas y aromas',
      ownerGroupName: 'Decorarte',
    });
    expect(mensaje).toContain('exclusivo del grupo «Decorarte»');
    expect(mensaje).toContain('la tienda «Decorarte Velas y aromas» no pertenece a ese grupo');
    expect(mensaje).toContain('Grupos de tiendas');
    expect(mensaje).not.toContain('otra tienda');
  });

  it('sin el nombre del grupo vuelve al genérico', () => {
    expect(catalogDenialMessage({ reason: 'other_group', storeName: 'X', ownerGroupName: null })).toBe(EXCLUSIVE_PRODUCT_MESSAGE);
  });

  it('en revisión lo dice así, no como exclusivo', () => {
    expect(catalogDenialMessage({ reason: 'in_review', storeName: 'X', ownerGroupName: null })).toContain('en revisión');
  });
});
