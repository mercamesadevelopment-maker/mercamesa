import { describe, expect, it } from 'vitest';
import { paymentTotals } from './payments';
import { creditNoteTotals } from './credit-notes';
import { refundTotals } from './refunds';
import { paginate, pageParams } from './paginate';

describe('totales de Contabilidad', () => {
  it('pagos: separa lo aprobado de lo demás', () => {
    expect(
      paymentTotals([
        { status: 'approved', amount: 100 },
        { status: 'approved', amount: 50 },
        { status: 'rejected', amount: 70 },
        { status: 'pending', amount: 30 },
      ])
    ).toEqual({ approved: 150, approvedCount: 2, notApproved: 100, notApprovedCount: 2 });
  });

  it('notas crédito: monto y conteo por estado', () => {
    expect(
      creditNoteTotals([
        { status: 'sent', amount: 10 },
        { status: 'pending', amount: 20 },
        { status: 'failed', amount: 5 },
        { status: 'skipped', amount: 1 },
      ])
    ).toEqual({ amount: 36, sent: 1, pending: 1, failed: 1 });
  });

  it('devoluciones en dinero: pendiente y pagado', () => {
    expect(
      refundTotals([
        { status: 'money_pending', amount: 40 },
        { status: 'money_paid', amount: 60 },
        { status: 'money_paid', amount: 15 },
      ])
    ).toEqual({ pending: 40, pendingCount: 1, paid: 75, paidCount: 2 });
  });
});

describe('paginate', () => {
  it('corta la página y deja los totales y el conteo de todo el filtro', () => {
    const rows = Array.from({ length: 7 }, (_, i) => i);
    expect(paginate(rows, { suma: 21 }, { page: 2, pageSize: 3 })).toEqual({
      rows: [3, 4, 5],
      totals: { suma: 21 },
      total: 7,
      page: 2,
      pageSize: 3,
    });
  });

  it('acota la página y el tamaño', () => {
    expect(pageParams(new URLSearchParams({ page: '-3', page_size: '5000' }))).toEqual({ page: 1, pageSize: 200 });
    expect(pageParams(new URLSearchParams())).toEqual({ page: 1, pageSize: 50 });
  });
});
