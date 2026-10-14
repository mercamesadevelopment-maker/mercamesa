import { describe, expect, it } from 'vitest';
import { splitE164, toE164, toNationalDigits } from './phone';

describe('toE164', () => {
  it('normaliza los formatos que ya hay guardados', () => {
    for (const input of ['3001234567', '+57 300 123 4567', '(300) 123-4567', ' 300 1234567 ']) {
      expect(toE164(input)).toBe('+573001234567');
    }
  });

  it('rechaza lo que no es un teléfono', () => {
    for (const input of ['correo@ejemplo.com', '123', '', null, undefined]) {
      expect(toE164(input)).toBeNull();
    }
  });
});

describe('splitE164 y toNationalDigits', () => {
  it('separan el indicativo como lo pide Pibox', () => {
    expect(splitE164('3001234567')).toEqual({ countryCode: '57', nationalNumber: '3001234567' });
    expect(toNationalDigits('+57 300 123 4567')).toBe('3001234567');
  });
});
