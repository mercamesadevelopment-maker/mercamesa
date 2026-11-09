import { describe, expect, it } from 'vitest';
import { hasOwnPickup, MARKETPLACE_PICKUP } from './pickup-mode';
import { parsePickupAddress } from './pickup-address';

describe('hasOwnPickup', () => {
  it('vacía: despacha desde la plaza', () => {
    expect(hasOwnPickup(MARKETPLACE_PICKUP)).toBe(false);
    expect(hasOwnPickup({ address: '   ', latitude: '', longitude: '' })).toBe(false);
  });

  it('con dirección, con punto o con las dos: tiene dirección propia', () => {
    expect(hasOwnPickup({ address: 'Calle 50 39-13', latitude: '', longitude: '' })).toBe(true);
    expect(hasOwnPickup({ address: '', latitude: '6.24', longitude: '-75.56' })).toBe(true);
    expect(hasOwnPickup({ address: 'Calle 50 39-13', latitude: '6.24', longitude: '-75.56' })).toBe(true);
  });
});

// Regresión (Vosmeraki y Decorarte, Placita de Flórez): una tienda que alguna
// vez tuvo dirección no podía volver a despachar desde la plaza, porque el
// formulario no dejaba quitar el punto del mapa. Lo que manda la casilla «Se
// recoge en la plaza» tiene que borrar la dirección al guardarse.
describe('volver a despachar desde la plaza', () => {
  it('MARKETPLACE_PICKUP limpia dirección y punto', () => {
    const resultado = parsePickupAddress({ ...MARKETPLACE_PICKUP });
    expect(resultado.error).toBeUndefined();
    expect(resultado.fields).toMatchObject({ address: null, latitude: null, longitude: null, city: null, department: null });
  });
});
