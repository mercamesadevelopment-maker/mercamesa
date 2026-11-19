import type { SupabaseClient } from '@supabase/supabase-js';
import { toE164 } from '@/lib/phone/phone';
import { resolveRoleKey } from '@/lib/auth/roles';

/**
 * Quién escribe por WhatsApp, a partir del teléfono que manda Meteor.
 *
 * Solo cuenta un teléfono **verificado**: el dueño de la cuenta mandó desde ese
 * número el código que le dio la app (`lib/phone/verification.ts`). Un número
 * que alguien escribió en su perfil sin verificar podría ser de otra persona, y
 * con él vería sus pedidos: responde `NO_VERIFICADO`.
 *
 * Un número es de una sola cuenta (índice `profiles_phone_unique`); `AMBIGUO`
 * queda como defensa por si eso fallara.
 */

export interface McpUser {
  userId: string;
  fullName: string;
  role: string;
  /** Tiendas de las que es miembro. Para las herramientas del tendero. */
  stores: { id: string; name: string }[];
  /** Plazas que atiende, si es de logística o patinador. */
  marketplaces: { id: string; name: string; role: string }[];
}

/** Cómo se llama el rol en el chat. El domiciliario es de Pibox y no tiene cuenta en MercaMesa. */
export type ChatRole = 'comprador' | 'tendero' | 'logistica' | 'patinador' | 'administrador' | 'contador';

export function chatRole(roleName: string): ChatRole {
  const key = resolveRoleKey(roleName);
  switch (key) {
    case 'provider':
      return 'tendero';
    case 'logistics':
      return 'logistica';
    case 'runner':
      return 'patinador';
    case 'admin':
      return 'administrador';
    case 'accountant':
      return 'contador';
    default:
      return 'comprador';
  }
}

export type IdentityResult =
  | { ok: true; user: McpUser }
  | { ok: false; code: 'TELEFONO_INVALIDO' | 'NO_IDENTIFICADO' | 'NO_VERIFICADO' | 'AMBIGUO'; message: string };

interface ProfileRow {
  id: string;
  full_name: string | null;
  phone_verified_at?: string | null;
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
  if (!rows[0].phone_verified_at) {
    return {
      ok: false,
      code: 'NO_VERIFICADO',
      message:
        'El teléfono no está verificado. La persona debe entrar a su perfil en MercaMesa, tocar «Verificar por WhatsApp» y enviar el código que le aparece.',
    };
  }
  return rows[0];
}

export async function identifyByPhone(service: SupabaseClient<any>, phone: string): Promise<IdentityResult> {
  const e164 = toE164(phone);
  if (!e164) return { ok: false, code: 'TELEFONO_INVALIDO', message: 'El teléfono no es válido.' };

  const { data, error } = await service
    .from('profiles')
    .select('id, full_name, phone_verified_at, roles ( name )')
    .eq('phone', e164)
    .eq('is_active', true)
    .limit(2);
  if (error) throw new Error(`No se pudo buscar el teléfono: ${error.message}`);

  const elegido = pickProfile((data ?? []) as unknown as ProfileRow[]);
  if ('ok' in elegido) return elegido;

  const [{ data: tiendas }, { data: plazas }] = await Promise.all([
    service.from('store_members').select('stores ( id, name )').eq('user_id', elegido.id),
    service
      .from('marketplace_staff')
      .select('role, marketplaces ( id, name )')
      .eq('user_id', elegido.id)
      .eq('is_active', true),
  ]);

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
      marketplaces: (plazas ?? [])
        .filter((p: any) => p.marketplaces)
        .map((p: any) => ({ id: p.marketplaces.id, name: p.marketplaces.name, role: p.role })),
    },
  };
}
