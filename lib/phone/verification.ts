import type { SupabaseClient } from '@supabase/supabase-js';
import {
  checkCodeRateLimit,
  claimCode,
  issueCode,
  CODE_EXPIRES_MINUTES,
  type CodeRateLimit,
} from '@/lib/auth/verification-codes';
import { toE164 } from './phone';

/**
 * Verificar que el teléfono del perfil es de quien tiene la cuenta.
 *
 * Al revés de los códigos por correo, acá el código **no se le envía** a la
 * persona: la app se lo muestra y ella se lo manda por WhatsApp a Carolina, el
 * agente de Meteor. Lo que prueba la verificación es que el mensaje sale de ese
 * número, y eso lo garantiza WhatsApp, no nosotros. Meteor llama al MCP
 * (`verificar_telefono`) con el número de quien escribe y el código.
 *
 * El código se busca por el teléfono, no por el usuario: es lo único que sabe
 * Meteor. Como un número es de una sola cuenta (índice único), no hay ambigüedad.
 */

export const PHONE_PURPOSE = 'phone_verification' as const;

/** El texto que queda escrito en WhatsApp, listo para enviar. */
export function verificationMessage(code: string): string {
  return `Hola, quiero verificar mi número en MercaMesa. Mi código es ${code}`;
}

/** `wa.me` pide el número solo con dígitos, sin `+` ni espacios. */
export function whatsappVerificationUrl(whatsappNumber: string, code: string): string {
  const digits = whatsappNumber.replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(verificationMessage(code))}`;
}

export type PhoneVerificationRequest =
  | { ok: true; code: string; expiresAt: string }
  | { ok: false; limit: CodeRateLimit };

export async function requestPhoneVerification(
  service: SupabaseClient<any>,
  { userId, email, phone, ip }: { userId: string; email: string; phone: string; ip: string | null }
): Promise<PhoneVerificationRequest> {
  const key = { column: 'phone' as const, value: phone };

  const limit = await checkCodeRateLimit({ service, purpose: PHONE_PURPOSE, key, ip });
  if (limit) return { ok: false, limit };

  const code = await issueCode({
    service,
    purpose: PHONE_PURPOSE,
    key,
    ip,
    extra: { user_id: userId, email },
  });

  return {
    ok: true,
    code,
    expiresAt: new Date(Date.now() + CODE_EXPIRES_MINUTES * 60_000).toISOString(),
  };
}

export type PhoneVerificationResult = { ok: true; userId: string; fullName: string } | { ok: false };

/**
 * Comprueba el código que llegó por WhatsApp desde `phone` y, si es el bueno,
 * marca el teléfono como verificado.
 *
 * Un código equivocado, vencido, ya usado o pedido para otro número responden
 * igual, como en los códigos por correo: desde afuera no se distinguen. Al
 * quinto intento fallido el código deja de servir (`claimCode`).
 */
export async function verifyPhoneCode(
  service: SupabaseClient<any>,
  { phone, code }: { phone: string; code: string }
): Promise<PhoneVerificationResult> {
  const e164 = toE164(phone);
  const limpio = code.replace(/\D/g, '');
  if (!e164 || limpio.length !== 6) return { ok: false };

  const claim = await claimCode({
    service,
    purpose: PHONE_PURPOSE,
    key: { column: 'phone', value: e164 },
    code: limpio,
  });

  // El mismo mensaje dos veces (Meteor reintenta): ya quedó verificado.
  if (claim.ok === 'duplicado') return verifiedOwner(service, e164);
  if (claim.ok !== true) return { ok: false };

  // `phone` en el filtro: si cambió el teléfono después de pedir el código, el
  // código era para el número viejo y no verifica el nuevo.
  const { data, error } = await service
    .from('profiles')
    .update({ phone_verified_at: new Date().toISOString() })
    .eq('id', claim.row.user_id)
    .eq('phone', e164)
    .select('id, full_name')
    .maybeSingle();

  if (error) throw new Error(`No se pudo verificar el teléfono: ${error.message}`);
  if (!data) return { ok: false };

  return { ok: true, userId: data.id, fullName: data.full_name ?? '' };
}

async function verifiedOwner(service: SupabaseClient<any>, e164: string): Promise<PhoneVerificationResult> {
  const { data } = await service
    .from('profiles')
    .select('id, full_name')
    .eq('phone', e164)
    .not('phone_verified_at', 'is', null)
    .maybeSingle();

  return data ? { ok: true, userId: data.id, fullName: data.full_name ?? '' } : { ok: false };
}
