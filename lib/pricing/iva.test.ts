import { describe, expect, it } from 'vitest';
import { includedIva, ivaLabel, parseIvaRate } from './iva';

describe('parseIvaRate', () => {
  it('lee la tarifa como la escribe una persona', () => {
    for (const valor of ['19 %', '19%', '19', '0,19', '0.19', 0.19, 19]) {
      expect(parseIvaRate(valor)).toBe(0.19);
    }
    expect(parseIvaRate('5 %')).toBe(0.05);
    expect(parseIvaRate('0 %')).toBe(0);
  });

  it('vacío es 0 %', () => {
    expect(parseIvaRate('')).toBe(0);
    expect(parseIvaRate('   ')).toBe(0);
    expect(parseIvaRate(null)).toBe(0);
    expect(parseIvaRate(undefined)).toBe(0);
  });

  it('rechaza lo que no es una tarifa que exista', () => {
    expect(parseIvaRate('7 %')).toBeNull();
    expect(parseIvaRate('exento')).toBeNull();
    expect(parseIvaRate('-19')).toBeNull();
    expect(parseIvaRate(120)).toBeNull();
  });
});

describe('ivaLabel', () => {
  it('muestra la tarifa como porcentaje', () => {
    expect(ivaLabel(0)).toBe('0 %');
    expect(ivaLabel(0.05)).toBe('5 %');
    expect(ivaLabel(0.19)).toBe('19 %');
  });
});

describe('includedIva', () => {
  it('es la parte del precio que es impuesto, sin cambiar el total', () => {
    expect(includedIva(11900, 0.19)).toBe(1900);
    expect(includedIva(10500, 0.05)).toBe(500);
  });

  it('en 0 % no hay impuesto', () => {
    expect(includedIva(25000, 0)).toBe(0);
  });
});
