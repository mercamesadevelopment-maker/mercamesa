import { describe, expect, it } from 'vitest';
import { accountClosedEmail, inactivityNoticeEmail } from './resend';

describe('correos del cierre por inactividad', () => {
  it('el aviso: dos semanas, la fecha de cierre y qué se conserva', () => {
    const html = inactivityNoticeEmail('Ana', new Date('2027-11-10T14:00:00Z'));
    expect(html).toContain('Ana, hace un año que no utilizas tu cuenta');
    expect(html).toContain('10 de noviembre de 2027');
    expect(html).toContain('conservando la información de facturación y las transacciones realizadas');
    // Sin enlaces: un correo que pide «ingresa para no perder tu cuenta» con un
    // enlace es justo lo que imita el phishing.
    expect(html).not.toMatch(/<a\s/i);
  });

  it('la confirmación: qué se borró, qué queda y cómo volver', () => {
    const html = accountClosedEmail('Ana');
    expect(html).toContain('anonimizamos y borramos tus datos');
    expect(html).toContain('en caso de una auditoría');
    expect(html).toContain('crear una cuenta nueva con este mismo correo');
  });

  it('el nombre no se mete crudo en el HTML', () => {
    expect(accountClosedEmail('<img src=x onerror=alert(1)>')).not.toContain('<img src=x');
  });
});
