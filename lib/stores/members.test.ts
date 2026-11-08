import { describe, expect, it } from 'vitest';
import { INVITATION_DAYS, invitationExpiry, normalizeEmail, toPendingInvitation } from './members';

describe('invitaciones de miembros de tienda', () => {
  it('vencen a los siete días de creadas o reenviadas', () => {
    const ahora = new Date('2026-10-29T15:00:00Z');
    expect(INVITATION_DAYS).toBe(7);
    expect(invitationExpiry(ahora).toISOString()).toBe('2026-11-05T15:00:00.000Z');
  });

  it('el correo se compara sin espacios ni mayúsculas', () => {
    expect(normalizeEmail('  Ana@Correo.COM ')).toBe('ana@correo.com');
  });

  it('una invitación pendiente se pinta como un miembro, con su rol y si venció', () => {
    const invite = { id: 'i', email: 'a@b.co', role: 'r1', created_at: '2026-10-01T00:00:00Z', expires_at: '2026-10-08T00:00:00Z' };
    const roles = { r1: { id: 'r1', name: 'seller', label: 'Vendedor' } };

    expect(toPendingInvitation(invite, roles, new Date('2026-10-05T00:00:00Z'))).toMatchObject({
      role_id: 'r1',
      roles: { label: 'Vendedor' },
      is_pending: true,
      expired: false,
    });
    // Justo al vencer ya no sirve.
    expect(toPendingInvitation(invite, roles, new Date('2026-10-08T00:00:00Z')).expired).toBe(true);
  });

  it('un rol que ya no existe se muestra como «Invitado»', () => {
    const invite = { id: 'i', email: 'a@b.co', role: 'borrado', created_at: '', expires_at: '2026-10-08T00:00:00Z' };
    expect(toPendingInvitation(invite, {}, new Date('2026-10-01T00:00:00Z')).roles).toEqual({ name: 'unknown', label: 'Invitado' });
  });
});
