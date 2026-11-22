import { describe, expect, it } from 'vitest';
import { hasIdentification, needsCheckDigit, parseStoreIdentification } from './store-identification';

const NIT = 'tipo-nit';
const CC = 'tipo-cc';

describe('parseStoreIdentification', () => {
  it('NIT con su dígito de verificación, sin puntos ni guion', () => {
    expect(parseStoreIdentification({ identification_type_id: NIT, document_number: '900.123.456', document_dv: '8' }, 'nit')).toEqual({
      fields: { identification_type_id: NIT, document_number: '900123456', document_dv: '8' },
    });
  });

  it('un DV que no corresponde no se guarda', () => {
    const r = parseStoreIdentification({ identification_type_id: NIT, document_number: '900123456', document_dv: '3' }, 'nit');
    expect(r).toEqual({ error: expect.stringContaining('dígito de verificación no corresponde') });
  });

  it('el NIT exige el DV escrito', () => {
    const r = parseStoreIdentification({ identification_type_id: NIT, document_number: '900123456' }, 'nit');
    expect(r).toEqual({ error: expect.stringContaining('dígito de verificación') });
  });

  it('una cédula no lleva DV, aunque llegue', () => {
    expect(parseStoreIdentification({ identification_type_id: CC, document_number: '1020304050', document_dv: '4' }, 'cedula')).toEqual({
      fields: { identification_type_id: CC, document_number: '1020304050', document_dv: null },
    });
  });

  it('el número se valida según su tipo', () => {
    expect(parseStoreIdentification({ identification_type_id: CC, document_number: '12AB' }, 'cedula')).toEqual({
      error: 'La cédula solo puede tener números.',
    });
  });

  it('un número sin tipo, o con un tipo que no existe, no se guarda', () => {
    expect(parseStoreIdentification({ document_number: '1020304050' }, null)).toEqual({
      error: 'Elige el tipo de identificación de la tienda.',
    });
    expect(parseStoreIdentification({ identification_type_id: 'no-existe', document_number: '1020304050' }, null)).toEqual({
      error: 'El tipo de identificación no existe.',
    });
  });

  it('vaciar el número borra la identificación', () => {
    expect(parseStoreIdentification({ identification_type_id: NIT, document_number: '  ', document_dv: '8' }, 'nit')).toEqual({
      fields: { identification_type_id: null, document_number: null, document_dv: null },
    });
  });
});

describe('hasIdentification y needsCheckDigit', () => {
  it('un cuerpo sin los campos no toca la identificación', () => {
    expect(hasIdentification({ name: 'Tienda' })).toBe(false);
    expect(hasIdentification({ document_number: '' })).toBe(true);
  });

  it('NIT y RUT llevan DV; la cédula no', () => {
    expect(needsCheckDigit('nit')).toBe(true);
    expect(needsCheckDigit('rut')).toBe(true);
    expect(needsCheckDigit('cedula')).toBe(false);
    expect(needsCheckDigit(null)).toBe(false);
  });
});
