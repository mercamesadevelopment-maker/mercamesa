import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateInviteLink } from './invite-link';

/** Un cliente de servicio que solo sabe generar enlaces, con la respuesta de cada tipo. */
function servicio(respuestas: Record<string, { link?: string; error?: string }>) {
  const generateLink = vi.fn(async ({ type }: { type: string }) => {
    const r = respuestas[type] ?? {};
    return r.error
      ? { data: null, error: { message: r.error } }
      : { data: { properties: { action_link: r.link } }, error: null };
  });
  return { client: { auth: { admin: { generateLink } } } as unknown as SupabaseClient<any>, generateLink };
}

describe('generateInviteLink', () => {
  it('a un correo nuevo le da el enlace de invitación', async () => {
    const { client, generateLink } = servicio({ invite: { link: 'https://x/invite' } });
    expect(await generateInviteLink(client, 'a@b.co', 'https://app/accept-invite')).toBe('https://x/invite');
    expect(generateLink).toHaveBeenCalledTimes(1);
  });

  // El caso de staging: se invitó, se abrió el enlace, se canceló la invitación
  // y al volver a invitar Supabase dice que el correo ya está registrado.
  it('si la cuenta ya existe por una invitación anterior, usa el enlace de acceso', async () => {
    const { client, generateLink } = servicio({
      invite: { error: 'A user with this email address has already been registered' },
      magiclink: { link: 'https://x/magic' },
    });
    expect(await generateInviteLink(client, 'a@b.co', 'https://app/accept-invite')).toBe('https://x/magic');
    expect(generateLink).toHaveBeenLastCalledWith({
      type: 'magiclink',
      email: 'a@b.co',
      options: { redirectTo: 'https://app/accept-invite' },
    });
  });

  it('si ninguno sale, devuelve null', async () => {
    const { client } = servicio({ invite: { error: 'x' }, magiclink: { error: 'y' } });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await generateInviteLink(client, 'a@b.co', 'https://app/accept-invite')).toBeNull();
  });
});
