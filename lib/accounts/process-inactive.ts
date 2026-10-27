import type { SupabaseClient } from '@supabase/supabase-js';
import { accountClosedEmail, inactivityNoticeEmail, sendEmail } from '@/lib/email/resend';
import { anonymizeAccount } from './anonymize-account';
import { rememberClosedEmail } from './closed-emails';
import { closesAt, inactiveBefore, nextStep } from './inactivity';

/** Cuentas por paso y por corrida: lo que falte sale al día siguiente. */
const POR_CORRIDA = 50;

export interface InactivityRunSummary {
  notified: number;
  closed: number;
  reactivated: number;
  postponed: number;
  failed: number;
}

/** Una cuenta ya vaciada no tiene a quién escribirle. */
const sinCorreoReal = (email: string | null) => !email || email.endsWith('@mercamesa.invalid');

/**
 * La corrida diaria del cierre por inactividad: avisa a quien cumplió un año sin
 * usar la cuenta y cierra la de quien, avisado hace dos semanas, no volvió.
 */
export async function processInactiveAccounts(
  service: SupabaseClient<any>,
  now = new Date()
): Promise<InactivityRunSummary> {
  const resumen: InactivityRunSummary = { notified: 0, closed: 0, reactivated: 0, postponed: 0, failed: 0 };

  // 1. Avisar. `inactive_accounts` ya deja fuera a quien tiene aviso.
  const { data: inactivos, error } = await service.rpc('inactive_accounts', {
    p_before: inactiveBefore(now).toISOString(),
    p_limit: POR_CORRIDA,
  });
  if (error) throw new Error(`inactive_accounts: ${error.message}`);

  for (const cuenta of inactivos ?? []) {
    if (sinCorreoReal(cuenta.email)) continue;
    const cierre = closesAt(now);
    try {
      // Primero el correo: si no sale, no se crea el aviso y se reintenta
      // mañana. Nunca se cierra la cuenta de alguien a quien no se le avisó.
      await sendEmail({
        to: cuenta.email,
        subject: 'Tu cuenta de MercaMesa será cerrada por inactividad',
        html: inactivityNoticeEmail(cuenta.full_name ?? '', cierre),
      });
      const { error: avisoError } = await service.from('account_inactivity_notices').insert({
        user_id: cuenta.user_id,
        notified_at: now.toISOString(),
        closes_at: cierre.toISOString(),
      });
      if (avisoError) throw avisoError;
      resumen.notified += 1;
    } catch (e) {
      console.error('inactive-accounts: no se pudo avisar a', cuenta.user_id, e);
      resumen.failed += 1;
    }
  }

  // 2. Los avisos vencidos: volvió (se borra el aviso) o se cierra.
  const { data: vencidos, error: vencidosError } = await service
    .from('account_inactivity_notices')
    .select('user_id, notified_at, closes_at')
    .lte('closes_at', now.toISOString())
    .order('closes_at')
    .limit(POR_CORRIDA);
  if (vencidosError) throw new Error(`account_inactivity_notices: ${vencidosError.message}`);

  for (const aviso of vencidos ?? []) {
    try {
      const { data: ultima } = await service.rpc('last_account_activity', { p_user: aviso.user_id });
      const paso = nextStep({
        lastActivity: new Date(ultima ?? 0),
        notice: { notifiedAt: new Date(aviso.notified_at), closesAt: new Date(aviso.closes_at) },
        now,
      });

      if (paso === 'cancel') {
        await borrarAviso(service, aviso.user_id);
        resumen.reactivated += 1;
        continue;
      }
      if (paso !== 'close') continue;

      // El correo y el nombre se leen ANTES de anonimizar: después ya no están.
      const { data: perfil } = await service
        .from('profiles')
        .select('email, full_name')
        .eq('id', aviso.user_id)
        .maybeSingle();

      const resultado = await anonymizeAccount(service, aviso.user_id);
      if ('message' in resultado) {
        // Pedidos en curso: el aviso se queda y se reintenta mañana.
        if (resultado.status === 409) resumen.postponed += 1;
        else {
          console.error('inactive-accounts: no se pudo cerrar', aviso.user_id, resultado.message);
          resumen.failed += 1;
        }
        continue;
      }

      await service.from('admin_user_actions').insert({
        actor_id: null,
        target_user_id: aviso.user_id,
        action: 'closed_inactive',
      });
      await borrarAviso(service, aviso.user_id);
      resumen.closed += 1;

      if (perfil && !sinCorreoReal(perfil.email)) {
        await rememberClosedEmail(service, perfil.email);
        // La confirmación es una cortesía: si no sale, la cuenta igual quedó cerrada.
        await sendEmail({
          to: perfil.email,
          subject: 'Cerramos tu cuenta de MercaMesa',
          html: accountClosedEmail(perfil.full_name ?? ''),
        }).catch((e) => console.error('inactive-accounts: no salió la confirmación', aviso.user_id, e));
      }
    } catch (e) {
      console.error('inactive-accounts: falló la cuenta', aviso.user_id, e);
      resumen.failed += 1;
    }
  }

  return resumen;
}

async function borrarAviso(service: SupabaseClient<any>, userId: string) {
  const { error } = await service.from('account_inactivity_notices').delete().eq('user_id', userId);
  if (error) throw error;
}

/** Al iniciar sesión, el aviso sobra: volvió. */
export async function clearInactivityNotice(service: SupabaseClient<any>, userId: string): Promise<void> {
  const { error } = await service.from('account_inactivity_notices').delete().eq('user_id', userId);
  if (error) console.error('inactive-accounts: no se pudo borrar el aviso al ingresar', error.message);
}
