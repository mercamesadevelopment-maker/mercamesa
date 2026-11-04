// lib/env.ts
export function getPublicSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  return url;
}

export function getPublicSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
  return key;
}

export function getServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  return key;
}

export function getResendApiKey(): string {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('Missing RESEND_API_KEY');
  return key;
}

export function getResendFromEmail(): string {
  const email = process.env.RESEND_FROM_EMAIL;
  if (!email) throw new Error('Missing RESEND_FROM_EMAIL');
  return email;
}
/**
 * El token con el que Meteor llama al MCP (`/api/mcp`), uno distinto por
 * entorno. Sin él el MCP no responde: `null` en vez de lanzar, para que la ruta
 * conteste 503 y no un error.
 */
export function getMeteorMcpToken(): string | null {
  return process.env.METEOR_MCP_TOKEN || null;
}

/**
 * El número de WhatsApp de Carolina (Meteor), al que el usuario manda el código
 * que verifica su teléfono. Sin él no se puede verificar: `null`, y la ruta
 * responde 503.
 */
export function getMeteorWhatsappNumber(): string | null {
  return process.env.METEOR_WHATSAPP_NUMBER || null;
}
