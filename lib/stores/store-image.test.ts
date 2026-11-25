import { describe, expect, it } from 'vitest';
import { storeImageError } from './store-image';

describe('storeImageError', () => {
  it('acepta una imagen de hasta 50 MB', () => {
    expect(storeImageError({ type: 'image/jpeg', size: 50 * 1024 * 1024 })).toBeNull();
  });

  it('rechaza lo que no es imagen', () => {
    expect(storeImageError({ type: 'application/pdf', size: 10 })).toBe('El archivo debe ser una imagen.');
  });

  it('rechaza una imagen de más de 50 MB', () => {
    expect(storeImageError({ type: 'image/png', size: 50 * 1024 * 1024 + 1 })).toMatch(/50 MB/);
  });
});
