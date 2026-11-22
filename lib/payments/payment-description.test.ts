import { describe, expect, it } from 'vitest';
import { paymentDescription, ZONAPAGOS_MAX_DESCRIPCION } from './payment-description';

const ID = '3f2b8c1e-9a4d-4e7b-b1c2-5d6e7f8a9b0c';

describe('paymentDescription', () => {
  it('sin tienda, solo el pedido', () => {
    expect(paymentDescription(ID)).toBe(`Pedido ${ID}`);
    expect(paymentDescription(ID, '  ')).toBe(`Pedido ${ID}`);
  });

  it('con una tienda corta, igual que antes', () => {
    expect(paymentDescription(ID, 'Frutas Don José')).toBe(`Pedido ${ID} - Frutas Don José`);
    expect(paymentDescription(ID, '3 tiendas')).toBe(`Pedido ${ID} - 3 tiendas`);
  });

  it('recorta un nombre largo para no pasar de 70 caracteres (el error de ZonaPagos)', () => {
    const larga = 'Distribuidora de Frutas y Verduras Eje'; // 39 caracteres, como la más larga en producción
    const d = paymentDescription(ID, larga);
    expect(d.length).toBeLessThanOrEqual(ZONAPAGOS_MAX_DESCRIPCION);
    expect(d.startsWith(`Pedido ${ID} - Distribuidora`)).toBe(true);
    expect(d.endsWith('…')).toBe(true);
  });

  it('justo en el límite no recorta', () => {
    const tienda = 'x'.repeat(ZONAPAGOS_MAX_DESCRIPCION - `Pedido ${ID} - `.length);
    expect(paymentDescription(ID, tienda)).toBe(`Pedido ${ID} - ${tienda}`);
  });
});
