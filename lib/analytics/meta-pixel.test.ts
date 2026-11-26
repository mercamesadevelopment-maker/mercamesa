import { describe, expect, it } from 'vitest';
import { parseMetaPixelId } from './meta-pixel';

describe('parseMetaPixelId', () => {
  it('acepta un ID de solo dígitos', () => {
    expect(parseMetaPixelId(' 1155231067412257 ')).toBe('1155231067412257');
  });

  it('sin variable no hay píxel', () => {
    expect(parseMetaPixelId(undefined)).toBeNull();
    expect(parseMetaPixelId('')).toBeNull();
  });

  it('rechaza lo que no son dígitos, para que no se ejecute nada en la página', () => {
    expect(parseMetaPixelId("123');alert(1);//")).toBeNull();
    expect(parseMetaPixelId('abc123')).toBeNull();
  });
});
