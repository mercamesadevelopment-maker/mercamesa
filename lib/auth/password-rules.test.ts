import { describe, expect, it } from 'vitest';
import { MIN_INVITE_PASSWORD_LENGTH, invitePasswordError } from './password-rules';

describe('contraseña al aceptar una invitación', () => {
  it('es la misma regla de Supabase: 6 caracteres', () => {
    expect(MIN_INVITE_PASSWORD_LENGTH).toBe(6);
  });

  it('pide la contraseña y rechaza una corta, antes de tocar la cuenta', () => {
    expect(invitePasswordError(undefined)).toMatch(/obligatorio/);
    expect(invitePasswordError('')).toMatch(/obligatorio/);
    expect(invitePasswordError(123456)).toMatch(/obligatorio/);
    expect(invitePasswordError('12345')).toMatch(/al menos 6/);
  });

  it('acepta una de 6 o más', () => {
    expect(invitePasswordError('123456')).toBeNull();
  });
});
