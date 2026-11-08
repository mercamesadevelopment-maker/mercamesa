import { describe, expect, it } from 'vitest';
import {
  canEditEvidence,
  canRecordReception,
  parseReceptionInput,
  RECEPTION_MAX_PHOTOS,
  RECEPTION_OBSERVATION_MAX,
} from './reception-rules';

const parte = (status: string, extra: Partial<{ collectedAt: string; bayReceivedAt: string }> = {}) => ({
  status,
  collectedAt: extra.collectedAt ?? null,
  bayReceivedAt: extra.bayReceivedAt ?? null,
});

const varias = (runnerRequired: boolean, logisticsRequired = true) => ({
  consolidated: true,
  config: { runnerRequired, logisticsRequired },
  marketplaceHasLogistics: logisticsRequired,
});

const unaSola = (marketplaceHasLogistics: boolean) => ({
  consolidated: false,
  config: { runnerRequired: false, logisticsRequired: false },
  marketplaceHasLogistics,
});

describe('canRecordReception', () => {
  it('varias tiendas sin patinador: cuando la tienda la dejó lista', () => {
    expect(canRecordReception(parte('packing'), varias(false))).toBe(false);
    expect(canRecordReception(parte('at_collection'), varias(false))).toBe(true);
  });

  it('varias tiendas con patinador: solo cuando él ya la recogió', () => {
    expect(canRecordReception(parte('at_collection'), varias(true))).toBe(false);
    expect(canRecordReception(parte('at_collection', { collectedAt: 'x' }), varias(true))).toBe(true);
  });

  it('un pedido de varias tiendas sin logística no se recibe en la bahía', () => {
    expect(canRecordReception(parte('at_collection'), varias(false, false))).toBe(false);
  });

  it('una sola tienda: si la plaza tiene logística y la parte está lista', () => {
    expect(canRecordReception(parte('at_collection'), unaSola(true))).toBe(true);
    expect(canRecordReception(parte('packing'), unaSola(true))).toBe(false);
    expect(canRecordReception(parte('at_collection'), unaSola(false))).toBe(false);
  });

  it('una parte ya recibida no se recibe otra vez', () => {
    expect(canRecordReception(parte('at_collection', { bayReceivedAt: 'x' }), varias(false))).toBe(false);
    expect(canRecordReception(parte('at_collection', { bayReceivedAt: 'x' }), unaSola(true))).toBe(false);
  });
});

describe('canEditEvidence', () => {
  it('recibida y todavía en la plaza', () => {
    expect(canEditEvidence(parte('at_collection', { bayReceivedAt: 'x' }))).toBe(true);
  });

  it('sin recibir no hay evidencia que completar', () => {
    expect(canEditEvidence(parte('at_collection'))).toBe(false);
  });

  it.each(['dispatched', 'delivered', 'cancelled', 'returned'])('%s: ya no se edita', (status) => {
    expect(canEditEvidence(parte(status, { bayReceivedAt: 'x' }))).toBe(false);
  });
});

describe('parseReceptionInput', () => {
  const foto = 'tmp/u/a.jpg';

  it('recibir sin foto no se puede', () => {
    expect(parseReceptionInput({ photos: [] }, { firstTime: true })).toEqual({
      error: expect.stringContaining('al menos una foto'),
    });
    expect(parseReceptionInput(undefined, { firstTime: true })).toHaveProperty('error');
  });

  it('completar la evidencia sí puede ir sin fotos nuevas', () => {
    expect(parseReceptionInput({ observation: 'Una bolsa rota' }, { firstTime: false })).toEqual({
      input: { photos: [], observation: 'Una bolsa rota', damaged: false },
    });
  });

  it('limpia la observación y la deja en null si viene vacía', () => {
    expect(parseReceptionInput({ photos: [foto], observation: '   ' }, { firstTime: true })).toEqual({
      input: { photos: [foto], observation: null, damaged: false },
    });
  });

  it('tope de fotos y de largo', () => {
    const muchas = Array.from({ length: RECEPTION_MAX_PHOTOS + 1 }, () => foto);
    expect(parseReceptionInput({ photos: muchas }, { firstTime: true })).toHaveProperty('error');
    expect(
      parseReceptionInput({ photos: [foto], observation: 'x'.repeat(RECEPTION_OBSERVATION_MAX + 1) }, { firstTime: true })
    ).toHaveProperty('error');
    expect(
      parseReceptionInput({ photos: [foto], observation: 'x'.repeat(RECEPTION_OBSERVATION_MAX) }, { firstTime: true })
    ).toHaveProperty('input');
  });

  it('mal estado exige contar qué pasó', () => {
    expect(parseReceptionInput({ photos: [foto], damaged: true }, { firstTime: true })).toEqual({
      error: 'Cuenta qué llegó en mal estado.',
    });
    expect(parseReceptionInput({ photos: [foto], damaged: true, observation: 'Tomates aplastados' }, { firstTime: true })).toEqual({
      input: { photos: [foto], observation: 'Tomates aplastados', damaged: true },
    });
  });

  it('solo `true` marca el mal estado', () => {
    expect(parseReceptionInput({ photos: [foto], damaged: 'sí' }, { firstTime: true })).toEqual({
      input: { photos: [foto], observation: null, damaged: false },
    });
  });

  it('una foto que no es texto no pasa', () => {
    expect(parseReceptionInput({ photos: [{ path: foto }] }, { firstTime: true })).toHaveProperty('error');
  });
});
