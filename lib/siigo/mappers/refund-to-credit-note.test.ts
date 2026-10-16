import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CreditNoteContext } from './refund-to-credit-note';

/**
 * La configuración se lee al importar `config.ts`, así que cada prueba fija las
 * variables y vuelve a importar el mapper.
 */
async function mapper(env: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return import('./refund-to-credit-note');
}

afterEach(() => {
  vi.unstubAllEnvs();
});

const ctx = (over: Partial<CreditNoteContext> = {}): CreditNoteContext => ({
  pqrsCode: 'PQR-2026-000001',
  orderCode: 'MM-2026-001000',
  siigoInvoiceId: '63f918c2-ca65-4edc-a7db-66bcdd5159fb',
  invoiceRequest: {
    cost_center: 10119,
    items: [
      { code: 'P-1', description: 'Tomate', quantity: 2, price: 5000 },
      { code: 'SRV', description: 'Servicio MercaMesa', quantity: 1, price: 1500 },
    ],
  },
  scope: 'order',
  products: 10000,
  serviceCommission: 0,
  platformCommission: 1500,
  total: 11500,
  items: [],
  deliveryProductCode: 'DOM',
  platformProductCode: 'SRV',
  ...over,
});

describe('buildCreditNotePayload', () => {
  it('sin comprobante configurado no arma nada', async () => {
    const { buildCreditNotePayload } = await mapper({ SIIGO_NC_DOCUMENT_ID: '' });
    expect(() => buildCreditNotePayload(ctx())).toThrow(/SIIGO_NC_DOCUMENT_ID/);
  });

  it('no envía centro de costo: el comprobante de nota crédito de la cuenta no lo maneja', async () => {
    const { buildCreditNotePayload } = await mapper({ SIIGO_NC_DOCUMENT_ID: '26737' });
    const p = buildCreditNotePayload(ctx());
    expect(p.document.id).toBe(26737);
    expect(p).not.toHaveProperty('cost_center');
  });

  it('lo envía si el comprobante se configura con centro de costo', async () => {
    const { buildCreditNotePayload } = await mapper({
      SIIGO_NC_DOCUMENT_ID: '26737',
      SIIGO_NC_USES_COST_CENTER: 'true',
    });
    expect(buildCreditNotePayload(ctx()).cost_center).toBe(10119);
  });

  it('pedido completo: motivo 2 (anulación), las líneas de la factura y la UUID de la factura', async () => {
    const { buildCreditNotePayload } = await mapper({ SIIGO_NC_DOCUMENT_ID: '26737' });
    const p = buildCreditNotePayload(ctx());
    expect(p.reason).toBe('2');
    expect(p.invoice).toBe('63f918c2-ca65-4edc-a7db-66bcdd5159fb');
    expect(p.items.map((i) => i.code)).toEqual(['P-1', 'SRV']);
    expect(p.payments[0].value).toBe(11500);
  });

  it('devolución parcial: motivo 1 y el total cuadra', async () => {
    const { buildCreditNotePayload } = await mapper({ SIIGO_NC_DOCUMENT_ID: '26737' });
    const p = buildCreditNotePayload(
      ctx({
        scope: 'items',
        products: 10000,
        serviceCommission: 0,
        platformCommission: 0,
        total: 5000,
        items: [{ siigoCode: 'P-1', description: 'Tomate', quantity: 1, amount: 5000 }],
      })
    );
    expect(p.reason).toBe('1');
    expect(p.items).toEqual([{ code: 'P-1', description: 'Tomate', quantity: 1, price: 5000 }]);
    expect(p.payments[0].value).toBe(5000);
  });
});
