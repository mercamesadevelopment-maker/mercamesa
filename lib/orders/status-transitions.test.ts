import { describe, expect, it } from 'vitest';
import { checkTransition } from './status-transitions';

describe('checkTransition', () => {
  it('avanza un paso a la vez, en el orden del panel', () => {
    expect(checkTransition('pending', 'confirmed').kind).toBe('advance');
    expect(checkTransition('confirmed', 'packing').kind).toBe('advance');
    expect(checkTransition('paid', 'packing').kind).toBe('advance');
    expect(checkTransition('packing', 'at_collection').kind).toBe('advance');
    expect(checkTransition('at_collection', 'dispatched').kind).toBe('advance');
    expect(checkTransition('dispatched', 'delivered').kind).toBe('advance');
  });

  it('no salta pasos ni retrocede', () => {
    expect(checkTransition('pending', 'delivered').kind).toBe('invalid');
    expect(checkTransition('confirmed', 'at_collection').kind).toBe('invalid');
    expect(checkTransition('packing', 'confirmed').kind).toBe('invalid');
  });

  it('una parte cerrada no se revive', () => {
    expect(checkTransition('cancelled', 'packing').kind).toBe('invalid');
    expect(checkTransition('returned', 'confirmed').kind).toBe('invalid');
    expect(checkTransition('delivered', 'dispatched').kind).toBe('invalid');
  });

  it('cancelar no es un avance: va por su propia ruta', () => {
    expect(checkTransition('packing', 'cancelled').kind).toBe('invalid');
  });

  it('el mismo estado no es un error: es un reintento', () => {
    expect(checkTransition('packing', 'packing').kind).toBe('same');
  });
});
