import { describe, expect, it } from 'vitest';
import { formatCOP } from './format';

describe('formatCOP', () => {
  it('separa los miles con punto', () => {
    expect(formatCOP(1240000)).toBe('$1.240.000');
  });

  it('lo vacío o inválido es $0', () => {
    expect(formatCOP(null)).toBe('$0');
    expect(formatCOP(undefined)).toBe('$0');
    expect(formatCOP(Number.NaN)).toBe('$0');
  });
});
