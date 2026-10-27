import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * La huella de los correos de cuentas cerradas por inactividad.
 *
 * Al cerrar una cuenta su correo se borra, así que si la persona vuelve e
 * intenta entrar le saldría «correo o contraseña incorrectos» sin saber por qué.
 * Se guarda solo la huella (sha256) para reconocer el correo si vuelve y decirle
 * que su cuenta se cerró y que puede crear una nueva.
 */
export function emailHash(email: string): string {
  return crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

export async function rememberClosedEmail(service: SupabaseClient<any>, email: string): Promise<void> {
  const { error } = await service
    .from('closed_account_emails')
    .upsert({ email_hash: emailHash(email), closed_at: new Date().toISOString() });
  if (error) throw new Error(`No se pudo guardar la huella del correo: ${error.message}`);
}

/** Cuándo se cerró la cuenta de ese correo, o `null` si no fue cerrada por inactividad. */
export async function wasClosedForInactivity(
  service: SupabaseClient<any>,
  email: string
): Promise<string | null> {
  const { data } = await service
    .from('closed_account_emails')
    .select('closed_at')
    .eq('email_hash', emailHash(email))
    .maybeSingle();
  return data?.closed_at ?? null;
}

/**
 * Al registrarse de nuevo, la huella sobra: si no se borra, una contraseña mal
 * escrita en la cuenta nueva le diría que su cuenta está cerrada.
 */
export async function forgetClosedEmail(service: SupabaseClient<any>, email: string): Promise<void> {
  const { error } = await service.from('closed_account_emails').delete().eq('email_hash', emailHash(email));
  if (error) console.error('closed-emails: no se pudo borrar la huella', error.message);
}
