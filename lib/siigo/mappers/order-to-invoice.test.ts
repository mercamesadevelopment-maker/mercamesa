import { describe, expect, it } from 'vitest';
import { buildInvoicePayload, type OrderInvoiceContext } from './order-to-invoice';

/**
 * Pedido del ejemplo de Parametrización: $50.000 en productos, gastos
 * administrativos (2,99 % = $1.495 y 15 % = $7.832,25), gastos operativos
 * (6 mensajes × $120 = $720) y $18.993 de domicilio.
 */
const ctx = (over: Partial<OrderInvoiceContext> = {}): OrderInvoiceContext => ({
  orderId: 'o1',
  orderCode: 'MM-2026-000001',
  subtotal: 50000,
  serviceCommission: 1495,
  messagesAmount: 720,
  platformCommission: 7832.25,
  deliveryFee: 18993,
  total: 50000 + 1495 + 720 + 7832.25 + 18993,
  discount: 0,
  paymentMethod: 'credit_card',
  creditApplied: 0,
  costCenterId: 1,
  deliveryProductCode: 'Domicilios',
  thirdPartyProductCode: 'Productos-de-Terceros',
  buyer: {
    identification: '123',
    fullName: 'Comprador',
    businessName: null,
    contactName: null,
    email: null,
    phone: null,
    siigoIdType: '13',
    requiresBusinessName: false,
    addressLine: null,
  },
  items: [
    { description: 'Tomate chonto', quantity: 2.5, unitPrice: 4000 },
    { description: 'Papa criolla', quantity: 8, unitPrice: 5000 },
  ],
  ...over,
});

const suma = (items: { taxed_price?: number; quantity: number }[]) =>
  Math.round(items.reduce((s, i) => s + (i.taxed_price ?? 0) * i.quantity, 0) * 100) / 100;

describe('buildInvoicePayload: productos de terceros y domicilio', () => {
  it('una línea por producto con el código de terceros y su valor real, y una de Domicilio con lo demás', () => {
    const p = buildInvoicePayload(ctx());
    expect(p.items).toEqual([
      { code: 'Productos-de-Terceros', description: 'Tomate chonto', quantity: 2.5, taxed_price: 4000 },
      { code: 'Productos-de-Terceros', description: 'Papa criolla', quantity: 8, taxed_price: 5000 },
      { code: 'Domicilios', description: 'Domicilio', quantity: 1, taxed_price: 29040.25 },
    ]);
    expect(suma(p.items)).toBe(ctx().total);
  });

  it('los productos suman exactamente lo del tendero', () => {
    const p = buildInvoicePayload(ctx());
    expect(suma(p.items.filter((i) => i.code === 'Productos-de-Terceros'))).toBe(50000);
  });

  it('ninguna línea es de servicio', () => {
    const p = buildInvoicePayload(ctx());
    expect(p.items.every((i) => i.description !== 'Servicio MercaMesa')).toBe(true);
  });

  it('el redondeo de centavos queda en Domicilio y el total cuadra', () => {
    const c = ctx({ items: [{ description: 'Limón', quantity: 3, unitPrice: 333.333 }], subtotal: 1000, total: 1000 + 1495 + 720 + 7832.25 + 18993 });
    const p = buildInvoicePayload(c);
    expect(suma(p.items)).toBe(c.total);
    expect(p.items.at(-1)?.description).toBe('Domicilio');
  });

  it('sin código de productos de terceros, se detiene y dice qué configurar', () => {
    expect(() => buildInvoicePayload(ctx({ thirdPartyProductCode: '' }))).toThrow(/Productos de terceros/);
  });

  it('con gastos y sin código de Domicilio, se detiene', () => {
    expect(() => buildInvoicePayload(ctx({ deliveryProductCode: '' }))).toThrow(/«Domicilio»/);
  });

  it('un pedido sin domicilio ni gastos no lleva la línea', () => {
    const p = buildInvoicePayload(
      ctx({ serviceCommission: 0, messagesAmount: 0, platformCommission: 0, deliveryFee: 0, total: 50000 })
    );
    expect(p.items.map((i) => i.description)).toEqual(['Tomate chonto', 'Papa criolla']);
  });

  it('si el total no cuadra con lo cobrado (un descuento), no esconde la diferencia en Domicilio', () => {
    expect(() => buildInvoicePayload(ctx({ total: ctx().total - 5000, discount: 5000 }))).toThrow(/no cuadra/);
  });

  it('el pago sigue sumando el total, con saldo a favor aparte', () => {
    const c = ctx({ creditApplied: 10000 });
    const p = buildInvoicePayload(c);
    expect(Math.round(p.payments.reduce((s, x) => s + x.value, 0) * 100) / 100).toBe(c.total);
  });
});
