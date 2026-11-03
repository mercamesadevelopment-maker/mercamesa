import type { SupabaseClient } from '@supabase/supabase-js';
import { toE164 } from '@/lib/phone/phone';

/**
 * Quién escribe por WhatsApp, a partir del teléfono que manda Meteor.
 *
 * El teléfono del perfil **no está verificado**: lo escribe la persona. Por eso
 * solo se acepta si es de una sola cuenta activa. Si se repite, no se elige
 * ninguna: Carolina responde que no puede identificarlo y pasa a un humano.
 * El riesgo que queda —alguien que puso en su perfil el número de otra
 * persona— está en `docs/mcp-meteor.md`.
 */

export interface McpUser {
  userId: string;
  fullName: string;
  role: string;
  /** Tiendas de las que es miembro. Para las herramientas del tendero. */
  stores: { id: string; name: string }[];
}

export type IdentityResult =
  | { ok: true; user: McpUser }
  | { ok: false; code: 'TELEFONO_INVALIDO' | 'NO_IDENTIFICADO' | 'AMBIGUO'; message: string };

interface ProfileRow {
  id: string;
  full_name: string | null;
  roles: { name: string } | null;
}

/** La decisión, sin base: cero, una o varias cuentas con ese teléfono. */
export function pickProfile(rows: ProfileRow[]): IdentityResult | ProfileRow {
  if (rows.length === 0) {
    return { ok: false, code: 'NO_IDENTIFICADO', message: 'No hay ninguna cuenta activa con ese teléfono.' };
  }
  if (rows.length > 1) {
    return {
      ok: false,
      code: 'AMBIGUO',
      message: 'Ese teléfono está en más de una cuenta: no se puede saber de quién es.',
    };
  }
  return rows[0];
}

export async function identifyByPhone(service: SupabaseClient<any>, phone: string): Promise<IdentityResult> {
  const e164 = toE164(phone);
  if (!e164) return { ok: false, code: 'TELEFONO_INVALIDO', message: 'El teléfono no es válido.' };

  const { data, error } = await service
    .from('profiles')
    .select('id, full_name, roles ( name )')
    .eq('phone', e164)
    .eq('is_active', true)
    .limit(2);
  if (error) throw new Error(`No se pudo buscar el teléfono: ${error.message}`);

  const elegido = pickProfile((data ?? []) as unknown as ProfileRow[]);
  if ('ok' in elegido) return elegido;

  const { data: tiendas } = await service
    .from('store_members')
    .select('stores ( id, name )')
    .eq('user_id', elegido.id);

  return {
    ok: true,
    user: {
      userId: elegido.id,
      fullName: elegido.full_name ?? '',
      role: elegido.roles?.name ?? 'buyer',
      stores: (tiendas ?? [])
        .map((t: any) => t.stores)
        .filter(Boolean)
        .map((s: any) => ({ id: s.id, name: s.name })),
    },
  };
}
