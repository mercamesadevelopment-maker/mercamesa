export interface PhoneVerificationCode {
  code: string;
  expiresAt: string;
  whatsappUrl: string;
}

/** Pide el código que el usuario le manda a Carolina por WhatsApp. */
export async function requestPhoneVerificationCode(): Promise<PhoneVerificationCode> {
  const res = await fetch('/api/profile/phone-verification', { method: 'POST' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? 'No pudimos generar el código.');
  return json as PhoneVerificationCode;
}
