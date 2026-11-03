import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { PqrsInputError } from '@/lib/pqrs/errors';
import { identifyByPhone, type McpUser } from './identity';
import { fail, type ToolResult } from './result';

/**
 * Corre una herramienta en nombre del comprador del teléfono. Si no se puede
 * identificar, responde con el código y no ejecuta nada.
 *
 * Un error esperable de la app (un caso que no existe, por ejemplo) se traduce
 * a su código; cualquier otro se registra y sale como `FALLO_CONSULTA`, sin el
 * detalle de la base.
 */
export async function asBuyer(
  phone: string,
  run: (ctx: { service: SupabaseClient<any>; user: McpUser }) => Promise<ToolResult>
): Promise<ToolResult> {
  const service = createSupabaseServiceClient() as unknown as SupabaseClient<any>;
  try {
    const identity = await identifyByPhone(service, phone);
    // `'code' in` y no `!identity.ok`: sin `strict`, TypeScript no estrecha por el booleano.
    if ('code' in identity) return fail(identity.code, identity.message);
    return await run({ service, user: identity.user });
  } catch (error: unknown) {
    return failure(error);
  }
}

export function failure(error: unknown): ToolResult {
  if (error instanceof PqrsInputError && error.status === 404) return fail('NO_EXISTE', error.message);
  console.error('[mcp] error no controlado', error);
  return fail('FALLO_CONSULTA', 'No se pudo completar la consulta. Intenta de nuevo en un momento.');
}
