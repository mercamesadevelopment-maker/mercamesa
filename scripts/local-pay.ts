/**
 * scripts/local-pay.ts
 *
 * Aprueba el pago de un pedido en la base LOCAL, sin pasarela (ver
 * `scripts/local/pay-order.ts`).
 *
 * Uso:
 *   pnpm local:pay MM-2026-001082
 *
 * Solo corre contra la base local: si la URL de Supabase no es de esta máquina,
 * se niega. Aprobar un pago a mano en producción es regalar un pedido.
 */
import { exitWithError, localEnv } from './local/env';
import { createClient } from '@supabase/supabase-js';
import { payLocalOrder } from './local/pay-order';

async function main() {
  const code = process.argv[2];
  if (!code) throw new Error('Falta el código del pedido. Ejemplo: pnpm local:pay MM-2026-001082');

  const { url, serviceKey } = localEnv();
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  console.log(await payLocalOrder(supabase, code));
}

main().catch(exitWithError);
