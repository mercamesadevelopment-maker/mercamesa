import { describe, expect, it } from 'vitest';
import { PRODUCT_CODE_MAX_LENGTH, productCodeOrNull, validateProductCode } from './product-code';

describe('validateProductCode', () => {
  it('vacío es válido: la base asigna uno', () => {
    expect(validateProductCode('')).toBeNull();
    expect(validateProductCode('   ')).toBeNull();
    expect(validateProductCode(undefined)).toBeNull();
  });

  it('el largo sigue teniendo tope', () => {
    expect(validateProductCode('x'.repeat(PRODUCT_CODE_MAX_LENGTH))).toBeNull();
    expect(validateProductCode('x'.repeat(PRODUCT_CODE_MAX_LENGTH + 1))).toContain(String(PRODUCT_CODE_MAX_LENGTH));
  });
});

describe('productCodeOrNull', () => {
  it('vacío o en blanco es null; lo demás se normaliza', () => {
    expect(productCodeOrNull('')).toBeNull();
    expect(productCodeOrNull('  ')).toBeNull();
    expect(productCodeOrNull(null)).toBeNull();
    expect(productCodeOrNull('  A  12 ')).toBe('A 12');
  });
});
