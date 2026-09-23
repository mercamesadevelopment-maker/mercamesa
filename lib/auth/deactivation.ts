import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Si una cuenta inactiva puede entrar o no.
 *
 * `profiles.is_active` no basta: hasta ahora nadie la leía al ingresar, así que
 * un usuario "inactivo" entraba igual y solo perdía los módulos de
 * administración (lo único que la mira es `has_permission`). Esto es lo que
 * convierte esa columna en un bloqueo de verdad, y lo usan los dos pasos del
 * login más `proxy.ts`.
 *
 * El vencimiento se resuelve acá, al intentar entrar, en vez de con un trabajo
 * programado: una inactivación vencida no le hace daño a nadie mientras la
 * persona no vuelva, y un cron sería una pieza más que mantener para adelantar
 * un momento que igual llega solo.
 */

/**
 * Lo mismo para todos, a propósito. El motivo lo escribió un administrador y no
 * está redactado para que lo lea el usuario; y decirle hasta cuándo invita a
 * esperar sentado en vez de escribir, que es lo que se quiere.
 */
export const MENSAJE_CUENTA_INACTIVA =
  'Tu cuenta está inactiva. Si crees que es un error, escríbenos a soporte@mercamesa.com.';

/**
 * Devuelve el mensaje que hay que mostrarle, o `null` si puede entrar.
 *
 * Levanta por su cuenta la inactivación que ya venció, y de paso vuelve a poner
 * `is_active` en verdadero: sin eso la persona quedaría bloqueada para siempre
 * aunque su periodo hubiera terminado.
 *
 * Necesita un cliente con service key: `profiles` no tiene ninguna política que
 * deje escribir el perfil de otro, y acá todavía no hay sesión del usuario.
 */
export async function bloqueoPorInactividad(
  service: SupabaseClient<any>,
  userId: string
): Promise<string | null> {
  const { data: perfil } = await service
    .from('profiles')
    .select('is_active')
    .eq('id', userId)
    .maybeSingle();

  // Sin perfil no hay nada que bloquear: el login sigue su camino normal y
  // decide por otras razones.
  if (!perfil || perfil.is_active !== false) return null;

  const { data: vigente } = await service
    .from('user_deactivations')
    .select('id, until')
    .eq('user_id', userId)
    .is('lifted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // `is_active` en falso sin fila de inactivación: pasa con las cuentas
  // anonimizadas, que se desactivan por otra vía. No se reactiva nada.
  if (!vigente) return MENSAJE_CUENTA_INACTIVA;

  const vencida = vigente.until !== null && new Date(vigente.until) <= new Date();
  if (!vencida) return MENSAJE_CUENTA_INACTIVA;

  // `lifted_by` en nulo es la marca de que venció sola, no de que alguien la
  // levantó a mano.
  await service
    .from('user_deactivations')
    .update({ lifted_at: new Date().toISOString(), lifted_by: null })
    .eq('id', vigente.id);

  await service.from('profiles').update({ is_active: true }).eq('id', userId);

  return null;
}

export type PeriodoInactivacion = '15d' | '1m' | '6m' | 'forever';

export const PERIODOS: PeriodoInactivacion[] = ['15d', '1m', '6m', 'forever'];

export const ETIQUETA_PERIODO: Record<PeriodoInactivacion, string> = {
  '15d': '15 días',
  '1m': 'Un mes',
  '6m': 'Seis meses',
  forever: 'Para siempre',
};

/**
 * Hasta cuándo dura la inactivación. `null` = para siempre.
 *
 * Se calcula siempre en el servidor: si la fecha viniera del navegador, una
 * petición armada a mano podría inactivar a alguien "hasta ayer".
 */
export function calcularVencimiento(periodo: PeriodoInactivacion): string | null {
  if (periodo === 'forever') return null;

  const hasta = new Date();
  if (periodo === '15d') hasta.setDate(hasta.getDate() + 15);
  if (periodo === '1m') hasta.setMonth(hasta.getMonth() + 1);
  if (periodo === '6m') hasta.setMonth(hasta.getMonth() + 6);

  return hasta.toISOString();
}
