import { describe, expect, it } from 'vitest';
import {
  canReceivePart,
  packingNotesForCourier,
  readyForCourier,
  runnerCommission,
  type ConsolidationConfig,
  type ConsolidationPart,
} from './consolidation';

const parte = (over: Partial<ConsolidationPart> = {}): ConsolidationPart => ({
  status: 'at_collection',
  collectedAt: null,
  bayReceivedAt: null,
  ...over,
});

const HORA = '2026-10-16T15:00:00Z';

const AMBOS: ConsolidationConfig = { runnerRequired: true, logisticsRequired: true };
const SOLO_LOGISTICA: ConsolidationConfig = { runnerRequired: false, logisticsRequired: true };
const SOLO_PATINADOR: ConsolidationConfig = { runnerRequired: true, logisticsRequired: false };
const NINGUNO: ConsolidationConfig = { runnerRequired: false, logisticsRequired: false };

describe('readyForCourier: cuándo se pide el mensajero', () => {
  it('patinador + logística: cuando logística recibió todas', () => {
    const recogidas = [parte({ collectedAt: HORA }), parte({ collectedAt: HORA })];
    expect(readyForCourier(AMBOS, recogidas, true)).toBe(false);

    const una = [parte({ collectedAt: HORA, bayReceivedAt: HORA }), parte({ collectedAt: HORA })];
    expect(readyForCourier(AMBOS, una, true)).toBe(false);

    const todas = recogidas.map((p) => ({ ...p, bayReceivedAt: HORA }));
    expect(readyForCourier(AMBOS, todas, false)).toBe(true);
  });

  it('solo logística: el tendero lleva y logística recibe', () => {
    expect(readyForCourier(SOLO_LOGISTICA, [parte(), parte()], false)).toBe(false);
    expect(readyForCourier(SOLO_LOGISTICA, [parte({ bayReceivedAt: HORA }), parte({ bayReceivedAt: HORA })], false)).toBe(true);
  });

  it('solo patinador: cuando él marca «Entregado en bahía» con todo recogido', () => {
    const recogidas = [parte({ collectedAt: HORA }), parte({ collectedAt: HORA })];
    expect(readyForCourier(SOLO_PATINADOR, recogidas, false)).toBe(false);
    expect(readyForCourier(SOLO_PATINADOR, recogidas, true)).toBe(true);
    expect(readyForCourier(SOLO_PATINADOR, [parte({ collectedAt: HORA }), parte()], true)).toBe(false);
  });

  it('ninguno: cuando todas las tiendas tienen lista su parte', () => {
    expect(readyForCourier(NINGUNO, [parte(), parte({ status: 'packing' })], false)).toBe(false);
    expect(readyForCourier(NINGUNO, [parte(), parte()], false)).toBe(true);
  });

  it('una parte cancelada no se espera', () => {
    expect(readyForCourier(NINGUNO, [parte(), parte({ status: 'cancelled' })], false)).toBe(true);
    expect(
      readyForCourier(SOLO_LOGISTICA, [parte({ bayReceivedAt: HORA }), parte({ status: 'returned' })], false)
    ).toBe(true);
  });

  it('con todas canceladas no hay nada que despachar', () => {
    expect(readyForCourier(NINGUNO, [parte({ status: 'cancelled' })], false)).toBe(false);
  });
});

describe('canReceivePart', () => {
  it('con patinador, logística recibe solo lo que él ya recogió', () => {
    expect(canReceivePart(parte(), AMBOS)).toBe(false);
    expect(canReceivePart(parte({ collectedAt: HORA }), AMBOS)).toBe(true);
  });

  it('sin patinador, lo que la tienda ya tiene listo', () => {
    expect(canReceivePart(parte(), SOLO_LOGISTICA)).toBe(true);
    expect(canReceivePart(parte({ status: 'packing' }), SOLO_LOGISTICA)).toBe(false);
  });

  it('no se recibe dos veces, ni en una plaza sin logística', () => {
    expect(canReceivePart(parte({ bayReceivedAt: HORA }), SOLO_LOGISTICA)).toBe(false);
    expect(canReceivePart(parte(), NINGUNO)).toBe(false);
  });
});

describe('runnerCommission', () => {
  it('porcentaje sobre los productos, redondeado al peso', () => {
    expect(runnerCommission('percent', 5, 79_000)).toBe(3_950);
    expect(runnerCommission('percent', 2.5, 33_333)).toBe(833);
  });

  it('valor fijo, sin importar el pedido', () => {
    expect(runnerCommission('fixed', 3_000, 79_000)).toBe(3_000);
  });

  it('sin configurar no hay comisión', () => {
    expect(runnerCommission(null, null, 79_000)).toBeNull();
    expect(runnerCommission('percent', null, 79_000)).toBeNull();
  });
});

describe('packingNotesForCourier', () => {
  it('una línea con cada tienda y cómo va empacada', () => {
    expect(
      packingNotesForCourier([
        { storeName: 'Fruver Ana', packingNotes: '2 bolsas,\n fríos en la azul' },
        { storeName: 'Carnes Toro', packingNotes: 'Todo en una bolsa blanca' },
      ])
    ).toBe('Pedido de 2 tiendas · Fruver Ana: 2 bolsas, fríos en la azul · Carnes Toro: Todo en una bolsa blanca');
  });

  it('una tienda sin nota aparece igual, para que se sepa que falta su parte', () => {
    expect(packingNotesForCourier([{ storeName: 'A', packingNotes: null }, { storeName: 'B', packingNotes: ' ' }])).toBe(
      'Pedido de 2 tiendas · A · B'
    );
  });

  it('no pasa del largo que acepta el paquete', () => {
    const larga = 'x'.repeat(600);
    const texto = packingNotesForCourier([
      { storeName: 'A', packingNotes: larga },
      { storeName: 'B', packingNotes: larga },
    ]);
    expect(texto.length).toBe(1000);
    expect(texto.endsWith('…')).toBe(true);
  });
});
