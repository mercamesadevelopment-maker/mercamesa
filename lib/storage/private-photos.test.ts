import { describe, expect, it } from 'vitest';
import { areOwnUploads, mimeOfPath } from './private-photos';
import { photoUploadError, PHOTO_MAX_BYTES } from './photo-rules';

describe('areOwnUploads', () => {
  const yo = '11111111-1111-1111-1111-111111111111';

  it('acepta solo lo que está en la carpeta temporal de quien pregunta', () => {
    expect(areOwnUploads(yo, [`tmp/${yo}/a.jpg`, `tmp/${yo}/b.webp`])).toBe(true);
    expect(areOwnUploads(yo, [])).toBe(true);
  });

  it('rechaza la foto de otro usuario o de un caso ya registrado', () => {
    expect(areOwnUploads(yo, ['tmp/22222222-2222-2222-2222-222222222222/a.jpg'])).toBe(false);
    expect(areOwnUploads(yo, ['some-store-order/a.jpg'])).toBe(false);
  });

  it('rechaza rutas que se salen de la carpeta', () => {
    expect(areOwnUploads(yo, [`tmp/${yo}/../otro/a.jpg`])).toBe(false);
    expect(areOwnUploads(yo, [`tmp/${yo}/sub/a.jpg`])).toBe(false);
  });

  it('rechaza lo que no es texto', () => {
    expect(areOwnUploads(yo, [42 as unknown as string])).toBe(false);
  });
});

describe('mimeOfPath', () => {
  it('saca el tipo de la extensión', () => {
    expect(mimeOfPath('x/a.jpg')).toBe('image/jpeg');
    expect(mimeOfPath('x/a.png')).toBe('image/png');
    expect(mimeOfPath('x/a.gif')).toBeNull();
  });
});

describe('photoUploadError', () => {
  it('acepta JPG, PNG y WebP hasta 8 MB', () => {
    expect(photoUploadError([{ type: 'image/jpeg', size: 1000 }, { type: 'image/webp', size: PHOTO_MAX_BYTES }], 6)).toBeNull();
  });

  it('rechaza lo demás', () => {
    expect(photoUploadError([], 6)).toBe('No hay fotos que subir.');
    expect(photoUploadError([{ type: 'image/gif', size: 10 }], 6)).toContain('JPG');
    expect(photoUploadError([{ type: 'image/png', size: PHOTO_MAX_BYTES + 1 }], 6)).toContain('8 MB');
    expect(photoUploadError([{ type: 'image/png', size: 0 }], 6)).toContain('8 MB');
    expect(photoUploadError(Array.from({ length: 7 }, () => ({ type: 'image/png', size: 1 })), 6)).toContain('hasta 6');
  });
});
