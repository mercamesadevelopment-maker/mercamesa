import { describe, expect, it } from 'vitest';
import { buyerInvoiceConcepts } from './buyer-concepts';
import { computeOrderPricing } from './compute-order-pricing';

describe('buyerInvoiceConcepts', () => {
  it('productos de terceros y domicilio suman el total del pedido', () => {
    const p = computeOrderPricing(50000, 18993, {
      serviceCommissionRate: 0.0299,
      messageUnitPrice: 120,
      messagesPerOrder: 6,
      platformCommissionRate: 0.15,
    });
    const c = buyerInvoiceConcepts(p.productsSubtotal, p.total);
    expect(c.thirdPartyProducts).toBe(50000);
    expect(c.delivery).toBe(p.deliveryFee + p.serviceCommission + p.messagesAmount + p.platformCommission);
    expect(c.thirdPartyProducts + c.delivery).toBe(p.total);
  });

  it('nunca negativos', () => {
    expect(buyerInvoiceConcepts(100, 50)).toEqual({ thirdPartyProducts: 100, delivery: 0 });
  });
});
