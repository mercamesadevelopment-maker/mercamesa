import { describe, expect, it } from 'vitest';
import { emailHash } from './closed-emails';

describe('emailHash', () => {
  it('el mismo correo da la misma huella, sin importar mayúsculas ni espacios', () => {
    expect(emailHash('  Ana.Perez@Correo.com ')).toBe(emailHash('ana.perez@correo.com'));
  });

  it('es sha256 en hex: lo que acepta la tabla', () => {
    expect(emailHash('ana@correo.com')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('correos distintos, huellas distintas', () => {
    expect(emailHash('ana@correo.com')).not.toBe(emailHash('ana@correo.co'));
  });
});
