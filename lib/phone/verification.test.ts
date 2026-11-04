import { describe, expect, it } from 'vitest';
import { verificationMessage, verifyPhoneCode, whatsappLineFor, whatsappVerificationUrl } from './verification';

describe('verificación del teléfono por WhatsApp', () => {
  it('el enlace abre el chat de Carolina con el código escrito', () => {
    const url = whatsappVerificationUrl('+57 300 123 4567', '048213');
    expect(url.startsWith('https://wa.me/573001234567?text=')).toBe(true);
    expect(decodeURIComponent(url.split('text=')[1])).toBe(verificationMessage('048213'));
    expect(verificationMessage('048213')).toContain('048213');
  });

  it('el tendero escribe a la línea de comerciantes; los demás, a la de compradores', () => {
    expect(whatsappLineFor('provider')).toBe('tenderos');
    expect(whatsappLineFor('retail')).toBe('compradores');
    expect(whatsappLineFor('wholesale')).toBe('compradores');
    expect(whatsappLineFor('runner')).toBe('compradores');
  });

  it('sin teléfono válido o con un código que no son 6 dígitos, ni se consulta la base', async () => {
    const sinBase = {} as never;
    await expect(verifyPhoneCode(sinBase, { phone: 'no es un número', code: '123456' })).resolves.toEqual({ ok: false });
    await expect(verifyPhoneCode(sinBase, { phone: '3001234567', code: '12345' })).resolves.toEqual({ ok: false });
    await expect(verifyPhoneCode(sinBase, { phone: '3001234567', code: 'abcdefg' })).resolves.toEqual({ ok: false });
  });
});
