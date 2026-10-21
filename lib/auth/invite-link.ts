import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * El enlace de una invitación, sin enviar ningún correo: se manda después con la
 * plantilla de la plataforma.
 *
 * `invite` solo sirve para un correo que todavía no existe en `auth.users`. Una
 * invitación anterior ya crea la cuenta, así que si se canceló o venció sin
 * completarse (o la persona abrió el enlace y no terminó el registro), volver a
 * invitarla falla. En ese caso el enlace de acceso (`magiclink`) la lleva al
 * mismo formulario de `/accept-invite`.
 *
 * Quien llama debe haber comprobado antes que el correo no tiene perfil: este
 * enlace inicia sesión en la cuenta, y solo es seguro para una cuenta que nació
 * de una invitación y nunca se completó.
 */
export async function generateInviteLink(
  service: SupabaseClient<any>,
  email: string,
  redirectTo: string
): Promise<string | null> {
  const invitacion = await service.auth.admin.generateLink({ type: 'invite', email, options: { redirectTo } });
  if (!invitacion.error && invitacion.data?.properties?.action_link) {
    return invitacion.data.properties.action_link;
  }

  const acceso = await service.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo } });
  if (!acceso.error && acceso.data?.properties?.action_link) {
    return acceso.data.properties.action_link;
  }

  console.error('invite-link: no se pudo generar el enlace', invitacion.error, acceso.error);
  return null;
}
