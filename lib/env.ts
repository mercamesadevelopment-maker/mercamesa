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
 * Los números de WhatsApp de Meteor, a los que el usuario manda el código que
 * verifica su teléfono. Son dos líneas: la de compradores y la de tenderos. Sin
 * la que le toca no se puede verificar: `null`, y la ruta responde 503.
 */
export function getMeteorWhatsappNumber(line: 'compradores' | 'tenderos'): string | null {
  const numero = line === 'tenderos' ? process.env.METEOR_WHATSAPP_SELLERS_NUMBER : process.env.METEOR_WHATSAPP_BUYERS_NUMBER;
  return numero || null;
}

export type DeploymentEnv = 'produccion' | 'staging' | 'local';

/**
 * En qué entorno corre esta copia de la app, según Vercel: `production` es
 * producción y cualquier vista previa (`development` y los PR) es staging, que
 * es a donde apuntan sus variables. Fuera de Vercel, local.
 */
export function getDeploymentEnv(): DeploymentEnv {
  const env = process.env.VERCEL_ENV;
  if (env === 'production') return 'produccion';
  if (env === 'preview') return 'staging';
  return 'local';
}
