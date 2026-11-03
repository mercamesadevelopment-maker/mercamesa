import { describe, expect, it } from 'vitest';
import {
  MAX_STORES_PER_ORDER,
  maxQtyFor,
  offerLimitLabel,
  offerLimitMessage,
  offerLimitViolations,
  tooManyStoresMessage,
} from './offer-limit';
import { parseMaxQty, validateOffer } from './validate-offer';

const linea = (quantity: number, maxQtyPerOrder: number | null, offerId: string | null = 'o1') => ({
  name: 'Papa criolla',
  unit: 'kg',
  quantity,
  offerId,
  maxQtyPerOrder,
});

describe('máximo por pedido de una oferta', () => {
  it('solo cuenta lo que pasa del máximo, no el máximo justo', () => {
    expect(offerLimitViolations([linea(3, 3)])).toEqual([]);
    expect(offerLimitViolations([linea(3.5, 3)])).toEqual([{ name: 'Papa criolla', unit: 'kg', requested: 3.5, max: 3 }]);
  });

  it('sin límite, o sin oferta aplicada (el mayorista), no hay tope', () => {
    expect(offerLimitViolations([linea(100, null)])).toEqual([]);
    expect(offerLimitViolations([linea(100, 2, null)])).toEqual([]);
  });

  it('acepta decimales, como en los productos por kg', () => {
    expect(offerLimitViolations([linea(1.5, 1.25)])).toHaveLength(1);
    expect(offerLimitLabel(1.25, 'kg')).toBe('Máx. 1.25 kg por pedido');
  });

  it('el mensaje nombra el producto y su máximo', () => {
    expect(offerLimitMessage(offerLimitViolations([linea(5, 3)]))).toContain('Papa criolla (máximo 3 kg)');
  });

  it('el contador se detiene en lo menor entre existencias y máximo', () => {
    expect(maxQtyFor(10, 3)).toBe(3);
    expect(maxQtyFor(2, 3)).toBe(2);
    expect(maxQtyFor(10, null)).toBe(10);
    expect(maxQtyFor(undefined, 3)).toBe(0);
  });
});

describe('tope de tiendas', () => {
  it('son 9, y el mensaje dice cuántas tiene el pedido', () => {
    expect(MAX_STORES_PER_ORDER).toBe(9);
    expect(tooManyStoresMessage(10)).toContain('hasta 9 tiendas, y el tuyo tiene 10');
  });
});

describe('validar el máximo al crear la oferta', () => {
  const base = { discountPct: 10, specialPrice: null, startsAt: '2026-11-01', endsAt: null };

  it('vacío es sin límite; un número mayor que cero vale', () => {
    expect(parseMaxQty('')).toBeNull();
    expect(validateOffer({ ...base, maxQtyPerOrder: parseMaxQty('') })).toBeNull();
    expect(validateOffer({ ...base, maxQtyPerOrder: parseMaxQty('2.5') })).toBeNull();
  });

  it('cero, negativo o texto se rechazan, no se toman por «sin límite»', () => {
    for (const valor of ['0', '-1', 'tres']) {
      expect(validateOffer({ ...base, maxQtyPerOrder: parseMaxQty(valor) })).toContain('máximo por pedido');
    }
  });
});
