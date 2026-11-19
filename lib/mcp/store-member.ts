import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeText } from '@/lib/utils/text';
import { asBuyer } from './buyer';
import { fail, type ToolResult } from './result';
import type { McpUser } from './identity';

/**
 * Corre una herramienta del tendero: la persona del teléfono tiene que ser del
 * equipo de una tienda, y la herramienta trabaja sobre una sola.
 *
 * Con una tienda no hace falta nombrarla. Con varias, `tienda` dice cuál (por
 * su nombre, sin tildes ni mayúsculas); sin ella, responde `AMBIGUO` con la
 * lista para que Carolina pregunte.
 */

export type StorePick = { ok: true; store: { id: string; name: string } } | { ok: false; code: 'NO_PERMITIDO' | 'AMBIGUO' | 'NO_EXISTE'; message: string };

/** Elige la tienda. Sin base. */
export function pickStore(stores: { id: string; name: string }[], wanted?: string | null): StorePick {
  if (stores.length === 0) {
    return { ok: false, code: 'NO_PERMITIDO', message: 'Esta persona no es del equipo de ninguna tienda.' };
  }
  const buscada = wanted ? normalizeText(wanted).trim() : '';
  if (!buscada) {
    if (stores.length === 1) return { ok: true, store: stores[0] };
    return { ok: false, code: 'AMBIGUO', message: `Tiene varias tiendas; di cuál: ${stores.map((s) => s.name).join(', ')}.` };
  }
  const exactas = stores.filter((s) => normalizeText(s.name).trim() === buscada);
  const candidatas = exactas.length ? exactas : stores.filter((s) => normalizeText(s.name).includes(buscada));
  if (candidatas.length === 1) return { ok: true, store: candidatas[0] };
  if (candidatas.length === 0) {
    return { ok: false, code: 'NO_EXISTE', message: `No tiene una tienda con ese nombre. Sus tiendas: ${stores.map((s) => s.name).join(', ')}.` };
  }
  return { ok: false, code: 'AMBIGUO', message: `Ese nombre coincide con varias de sus tiendas: ${candidatas.map((s) => s.name).join(', ')}.` };
}

export function asStoreMember(
  phone: string,
  wanted: string | null | undefined,
  run: (ctx: { service: SupabaseClient<any>; user: McpUser; store: { id: string; name: string } }) => Promise<ToolResult>
): Promise<ToolResult> {
  return asBuyer(phone, async ({ service, user }) => {
    const pick = pickStore(user.stores, wanted);
    if ('code' in pick) return fail(pick.code, pick.message);
    return run({ service, user, store: pick.store });
  });
}
