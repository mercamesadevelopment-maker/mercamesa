import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Códigos de 6 dígitos enviados por correo.
 *
 * La misma lógica —hash sha256, ventana de vencimiento, límite por persona y por
 * IP, intentos, espera para reenviar— estaba copiada en `forgot-password` y en
 * `request-email-change`. Con el cambio de contraseña, el registro y el ingreso
 * de administradores serían cinco copias de las mismas reglas, y basta con que
 * una se quede atrás para que sea la que se pueda forzar.
 *
 * Las cuatro tablas tienen la misma forma a propósito; lo único que cambia es si
 * el código se le atribuye a un usuario o a un correo (en el registro todavía no
 * hay usuario, que es justamente el punto).
 */

export type CodeTable =
  | 'email_change_codes'
  | 'password_change_codes'
  | 'signup_email_codes'
  | 'admin_login_codes';

export type CodeKey = { column: 'user_id' | 'email'; value: string };

export const CODE_EXPIRES_MINUTES = 10;
export const RESEND_COOLDOWN_SECONDS = 30;
const MAX_CODES_PER_KEY = 3;
const KEY_WINDOW_MINUTES = 15;
const MAX_REQUESTS_PER_IP = 10;
const IP_WINDOW_MINUTES = 60;
/** Cuánto rato después de reclamar un código se sigue tratando como el mismo
 *  envío. Cubre un doble clic y los reintentos de red, no un código reusado. */
const CLAIM_DUPLICATE_WINDOW_SECONDS = 60;

/** El mismo mensaje para todo lo que falle al verificar: un código equivocado,
 *  uno vencido y uno de otra persona no deben distinguirse desde afuera. */
export const GENERIC_CODE_ERROR = 'Código inválido o expirado';

export function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/** `randomInt` y no `Math.random()`: esto protege una cuenta. */
export function generateCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function getClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return request.headers.get('x-real-ip');
}

/** Lo que devuelve un límite alcanzado. `null` significa "adelante". */
export type CodeRateLimit = {
  status: number;
  error: string;
  retryAfterSeconds?: number;
};

/**
 * Tres frenos distintos, en orden de lo más específico a lo más general:
 * reenviar demasiado pronto, pedir demasiados para una misma cuenta, y pedir
 * demasiados desde una misma IP (que es lo que frena el barrido de correos).
 */
export async function checkCodeRateLimit({
  service,
  table,
  key,
  ip,
}: {
  service: SupabaseClient<any>;
  table: CodeTable;
  key: CodeKey;
  ip: string | null;
}): Promise<CodeRateLimit | null> {
  const now = Date.now();

  const { data: ultimo } = await service
    .from(table)
    .select('created_at')
    .eq(key.column, key.value)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (ultimo) {
    const transcurrido = (now - new Date(ultimo.created_at).getTime()) / 1000;
    if (transcurrido < RESEND_COOLDOWN_SECONDS) {
      return {
        status: 429,
        error: 'Espera unos segundos antes de pedir otro código.',
        retryAfterSeconds: Math.ceil(RESEND_COOLDOWN_SECONDS - transcurrido),
      };
    }
  }

  const { count: porClave } = await service
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq(key.column, key.value)
    .gte('created_at', new Date(now - KEY_WINDOW_MINUTES * 60_000).toISOString());

  if ((porClave ?? 0) >= MAX_CODES_PER_KEY) {
    return {
      status: 429,
      error: 'Pediste demasiados códigos. Intenta de nuevo en unos minutos.',
    };
  }

  if (ip) {
    const { count: porIp } = await service
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('request_ip', ip)
      .gte('created_at', new Date(now - IP_WINDOW_MINUTES * 60_000).toISOString());

    if ((porIp ?? 0) >= MAX_REQUESTS_PER_IP) {
      return {
        status: 429,
        error: 'Demasiadas solicitudes. Intenta de nuevo más tarde.',
      };
    }
  }

  return null;
}

/**
 * Genera el código, invalida los pendientes anteriores y guarda solo su hash.
 * Devuelve el código en claro para enviarlo por correo — es la única vez que
 * existe legible, y no se registra en ningún log.
 */
export async function issueCode({
  service,
  table,
  key,
  ip,
  extra,
}: {
  service: SupabaseClient<any>;
  table: CodeTable;
  key: CodeKey;
  ip: string | null;
  /** Columnas propias de la tabla, p. ej. el `email` junto al `user_id`. */
  extra?: Record<string, unknown>;
}): Promise<string> {
  // Si quedara vivo el código anterior, pedir uno nuevo no invalidaría el que
  // ya se hubiera filtrado.
  await service
    .from(table)
    .update({ consumed_at: new Date().toISOString() })
    .eq(key.column, key.value)
    .is('consumed_at', null);

  const code = generateCode();

  const { error } = await service.from(table).insert({
    [key.column]: key.value,
    ...extra,
    code_hash: hashCode(code),
    expires_at: new Date(Date.now() + CODE_EXPIRES_MINUTES * 60_000).toISOString(),
    request_ip: ip,
  });

  if (error) throw new Error(error.message);

  return code;
}

type ConsumeResult =
  | { ok: true; row: { id: string; [k: string]: any } }
  | { ok: false };

/**
 * Comprueba el código contra el más reciente que siga vivo. **No** lo marca como
 * usado: eso se hace con `markCodeConsumed` cuando la operación de verdad haya
 * salido bien, para que un fallo posterior no deje a la persona sin código y sin
 * resultado.
 *
 * Por eso mismo NO protege de dos peticiones simultáneas: las dos verifican
 * bien y las dos siguen. Para lo nuevo usar `claimCode`, que verifica y reclama
 * en un paso y conserva la misma propiedad vía `releaseCode`.
 */
export async function consumeCode({
  service,
  table,
  key,
  code,
}: {
  service: SupabaseClient<any>;
  table: CodeTable;
  key: CodeKey;
  code: string;
}): Promise<ConsumeResult> {
  const { data: row } = await service
    .from(table)
    .select('*')
    .eq(key.column, key.value)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row || row.attempts >= row.max_attempts) return { ok: false };

  if (hashCode(code) !== row.code_hash) {
    // Contar el intento fallido es lo que impide probar el millón de
    // combinaciones de seis dígitos.
    await service
      .from(table)
      .update({ attempts: row.attempts + 1 })
      .eq('id', row.id);

    return { ok: false };
  }

  return { ok: true, row };
}

export type ClaimResult =
  | { ok: true; row: { id: string; [k: string]: any } }
  | { ok: false }
  /** El código era el correcto, pero otra petición ya se lo llevó. */
  | { ok: 'duplicado' };

/**
 * Verifica el código Y lo reclama, en un solo paso.
 *
 * `consumeCode` solo verifica: marcarlo se deja para el final de la operación,
 * para que un fallo posterior no queme el código. El efecto secundario es que
 * dos peticiones a la vez —un doble clic en el botón— pasan LAS DOS la
 * verificación y siguen las dos adelante. En el registro eso terminaba con la
 * segunda chocando contra `signUp` y diciéndole a la persona que ya hay una
 * cuenta con ese correo: la que acababa de crear.
 *
 * El reclamo es un solo `UPDATE ... WHERE id = :id AND consumed_at IS NULL`, y
 * es eso lo que serializa: Postgres bloquea la fila, así que exactamente una
 * petición se la lleva y el resto recibe cero filas.
 *
 * Quien reclama se compromete a llamar a `releaseCode` si la operación falla
 * después, o el código quedaría quemado sin haber servido para nada — que es
 * justo lo que `consumeCode` evitaba.
 */
export async function claimCode({
  service,
  table,
  key,
  code,
}: {
  service: SupabaseClient<any>;
  table: CodeTable;
  key: CodeKey;
  code: string;
}): Promise<ClaimResult> {
  const { data: row } = await service
    .from(table)
    .select('*')
    .eq(key.column, key.value)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (row && row.attempts < row.max_attempts) {
    if (hashCode(code) !== row.code_hash) {
      // Contar el intento fallido es lo que impide probar el millón de
      // combinaciones de seis dígitos. Ojo: acá NO se reclama nada, o un código
      // equivocado dejaría inservible al bueno.
      await service
        .from(table)
        .update({ attempts: row.attempts + 1 })
        .eq('id', row.id);

      return { ok: false };
    }

    const { data: reclamada } = await service
      .from(table)
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', row.id)
      .is('consumed_at', null)
      .select()
      .maybeSingle();

    if (reclamada) return { ok: true, row: reclamada };
  }

  /**
   * No se pudo reclamar. Puede ser un código equivocado o vencido, o puede ser
   * la segunda mitad de un doble clic: la fila correcta existe, el hash coincide
   * y la reclamó otra petición hace un instante. Distinguirlo es lo que permite
   * responder lo mismo que respondió la primera en vez de un error falso.
   *
   * La ventana es corta a propósito: pasado ese rato ya no es un doble clic
   * sino alguien reusando un código quemado.
   */
  const { data: reciente } = await service
    .from(table)
    .select('*')
    .eq(key.column, key.value)
    .eq('code_hash', hashCode(code))
    .not('consumed_at', 'is', null)
    .gte('consumed_at', new Date(Date.now() - CLAIM_DUPLICATE_WINDOW_SECONDS * 1000).toISOString())
    .order('consumed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (reciente) return { ok: 'duplicado' };

  return { ok: false };
}

/**
 * Suelta un código reclamado, para que la persona pueda reintentar con el mismo.
 * Se llama en los caminos de fallo posteriores a `claimCode`.
 */
export async function releaseCode({
  service,
  table,
  id,
}: {
  service: SupabaseClient<any>;
  table: CodeTable;
  id: string;
}): Promise<void> {
  await service.from(table).update({ consumed_at: null }).eq('id', id);
}

export async function markCodeConsumed({
  service,
  table,
  id,
}: {
  service: SupabaseClient<any>;
  table: CodeTable;
  id: string;
}): Promise<void> {
  await service
    .from(table)
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', id);
}
