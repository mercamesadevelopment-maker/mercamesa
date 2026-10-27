import { describe, expect, it } from 'vitest';
import { invoiceLinkFor, type SiigoInvoiceRow } from './invoice-link';

const URL_SIIGO = 'https://siigonube.siigo.com/factura/abc';

function fila(over: Partial<SiigoInvoiceRow> = {}): SiigoInvoiceRow {
  return {
    order_id: 'pedido',
    status: 'sent',
    stamped: true,
    siigo_number: '123',
    response_payload: { public_url: URL_SIIGO, name: 'FV-1-123' },
    ...over,
  };
}

describe('invoiceLinkFor', () => {
  it('timbrada: el comprador y el admin ven el enlace', () => {
    const esperado = { state: 'available', number: 'FV-1-123', url: URL_SIIGO, draft: false };
    expect(invoiceLinkFor(fila(), 'buyer')).toEqual(esperado);
    expect(invoiceLinkFor(fila(), 'platform')).toEqual(esperado);
  });

  it('borrador: el comprador la ve en proceso y el admin la ve marcada como borrador', () => {
    const borrador = fila({ stamped: false });
    expect(invoiceLinkFor(borrador, 'buyer')).toEqual({ state: 'processing', number: null, url: null, draft: false });
    expect(invoiceLinkFor(borrador, 'platform')).toMatchObject({ state: 'available', url: URL_SIIGO, draft: true });
  });

  it('pendiente de enviar, o enviada sin enlace: en proceso', () => {
    expect(invoiceLinkFor(fila({ status: 'pending', response_payload: null }), 'platform')?.state).toBe('processing');
    expect(invoiceLinkFor(fila({ response_payload: { name: 'FV-1-123' } }), 'platform')?.state).toBe('processing');
  });

  it('sin fila, omitida o fallida: no se muestra nada', () => {
    expect(invoiceLinkFor(null, 'buyer')).toBeNull();
    expect(invoiceLinkFor(fila({ status: 'skipped' }), 'platform')).toBeNull();
    expect(invoiceLinkFor(fila({ status: 'failed' }), 'platform')).toBeNull();
  });

  it('una URL que no es https no se muestra', () => {
    for (const public_url of ['http://siigo.com/x', 'javascript:alert(1)', 'no es url', 42]) {
      expect(invoiceLinkFor(fila({ response_payload: { public_url } }), 'platform')?.state).toBe('processing');
    }
  });

  it('sin nombre en la respuesta usa el número de Siigo', () => {
    expect(invoiceLinkFor(fila({ response_payload: { public_url: URL_SIIGO } }), 'buyer')?.number).toBe('123');
  });
});
