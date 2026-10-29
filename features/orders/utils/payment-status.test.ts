import { describe, expect, it } from 'vitest';
import { isPaymentApproved } from './payment-status';

describe('isPaymentApproved', () => {
  it('acepta approved y el paid de los pedidos viejos', () => {
    expect(isPaymentApproved('approved')).toBe(true);
    expect(isPaymentApproved('paid')).toBe(true);
  });

  it('rechaza todo lo demás, incluido el pago ausente', () => {
    for (const s of ['pending', 'rejected', 'failed', '', null, undefined]) {
      expect(isPaymentApproved(s)).toBe(false);
    }
  });
});
