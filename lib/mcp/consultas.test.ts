import { describe, expect, it } from 'vitest';
import { chatRole } from './identity';
import { toPaymentStatus, type RefundRow } from '@/lib/orders/buyer-payment';
import { purchaseRules } from '@/lib/orders/purchase-rules';
import { pickupPoints, type CoverageStoreRow } from '@/lib/orders/coverage';
import { MAX_STORES_PER_ORDER } from '@/lib/offers/offer-limit';
import { toPaymentStatusView } from './views';

describe('identificar_usuario: el rol para el chat', () => {
  it('tendero, logística, patinador y comprador', () => {
    expect(chatRole('seller')).toBe('tendero');
    expect(chatRole('store_owner')).toBe('tendero');
    expect(chatRole('logistics')).toBe('logistica');
    expect(chatRole('runner')).toBe('patinador');
    expect(chatRole('buyer')).toBe('comprador');
    expect(chatRole('superadmin')).toBe('administrador');
    expect(chatRole('delivery')).toBe('comprador');
  });
});

describe('estado_pago', () => {
  const pedido = { code: 'MM-2026-000010', payment_status: 'approved', total: 80000, credit_applied: 5000 };
  const devolucion = (over: Partial<RefundRow>): RefundRow => ({
    origin: 'pqrs',
    total_amount: 12000,
    method: 'credit',
    status: 'credited',
    created_at: '2026-11-10T10:00:00Z',
    money_paid_at: null,
    store_orders: { code: 'MM-2026-000010-1' },
    stores: { name: 'Tienda A' },
    pqrs: { code: 'PQR-2026-000019' },
    ...over,
  });

  it('dice qué hacer con cada estado del pago', () => {
    expect(toPaymentStatus({ ...pedido, payment_status: 'rejected' }, []).help).toMatch(/no se cobró nada/);
    expect(toPaymentStatus({ ...pedido, payment_status: 'pending' }, []).help).toMatch(/Pagar/);
    expect(toPaymentStatus(pedido, []).statusLabel).toBe('Aprobado');
  });

  it('las devoluciones, en orden, por caso o por cancelación, y si hay dinero en trámite', () => {
    const r = toPaymentStatus(pedido, [
      devolucion({ origin: 'store_cancel', pqrs: null, method: 'money', status: 'money_pending', created_at: '2026-11-12T00:00:00Z' }),
      devolucion({}),
    ]);
    expect(r.refunds.map((d) => d.reason)).toEqual(['caso', 'cancelacion']);
    expect(r.refunds[0]).toMatchObject({ caseCode: 'PQR-2026-000019', method: 'Saldo a favor en MercaMesa', statusLabel: 'Abonado como saldo a favor' });
    expect(r.refundInProgress).toBe(true);
  });

  it('no deja salir referencias ni datos del banco', () => {
    const vista = JSON.stringify(
      toPaymentStatusView(
        toPaymentStatus(pedido, [{ ...devolucion({}), money_reference: 'TRANSF-123', zonapagos_token: 'x' } as RefundRow])
      )
    );
    expect(vista).not.toContain('TRANSF-123');
    expect(vista).not.toMatch(/zonapagos|token|tarjeta/i);
  });
});

describe('reglas_de_compra', () => {
  it('mínimo, máximo de tiendas y cómo sale un pedido de varias tiendas en cada plaza', () => {
    const r = purchaseRules(30000, [
      { name: 'Minorista', slug: 'minorista', runner_enabled: true, logistics_enabled: true },
      { name: 'Placita', slug: 'placita', runner_enabled: false, logistics_enabled: false },
    ]);
    expect(r.minimumOrder).toBe(30000);
    expect(r.maxStoresPerOrder).toBe(MAX_STORES_PER_ORDER);
    expect(r.marketplaces[0].howItLeaves).toMatch(/patinador.*logística/);
    expect(r.marketplaces[1].howItLeaves).toMatch(/cada tienda lleva su parte/);
  });
});

describe('consultar_cobertura: puntos de recogida', () => {
  const horario = [1, 2, 3, 4, 5, 6, 7].map((day) => ({ day, is_closed: false, open_time: '06:00', close_time: '18:00' }));
  const tienda = (over: Partial<CoverageStoreRow>): CoverageStoreRow => ({
    id: 't1',
    name: 'Carnes',
    pickup_group: 'plaza:m1',
    business_hours: horario,
    marketplaces: { name: 'Minorista', is_active: true },
    ...over,
  });

  it('las tiendas de una plaza comparten punto; una con dirección propia va aparte', () => {
    const puntos = pickupPoints([
      tienda({}),
      tienda({ id: 't2', name: 'Arepas' }),
      tienda({ id: 't3', name: 'Quesos', pickup_group: 'tienda:t3' }),
      tienda({ id: 't4', name: 'Cerrada', marketplaces: { name: 'Otra', is_active: false } }),
    ], new Date('2026-11-18T15:00:00Z'));
    expect(puntos.map((p) => [p.from, p.stores.map((s) => s.name)])).toEqual([
      ['plaza', ['Arepas', 'Carnes']],
      ['tienda', ['Quesos']],
    ]);
    expect(puntos[0].quoteStoreId).toBe('t1');
    // 15:00 UTC son las 10:00 en Colombia.
    expect(puntos[0].stores[0]).toMatchObject({ open: true });
  });

  it('una tienda sin horario no se da por abierta', () => {
    const [p] = pickupPoints([tienda({ business_hours: null })]);
    expect(p.stores[0]).toEqual({ name: 'Carnes', open: false, hoursLabel: 'Sin horario publicado' });
  });
});
