import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeText } from '@/lib/utils/text';
import { orderCodeFrom } from '@/lib/orders/buyer-orders';
import { PQRS_REASONS, type PqrsReason } from '@/lib/pqrs/reasons';
import { PqrsInputError } from '@/lib/pqrs/errors';

/**
 * Lo que llega por el chat para radicar o ampliar un caso, traducido a lo que
 * reciben `createPqrs` y `addPqrsMessage`: la parte del pedido por su código y
 * los productos por su nombre. Las reglas del caso (plazos, fotos, quién puede
 * radicar qué) siguen siendo las de `lib/pqrs`; esto solo traduce.
 */

/** La parte de un pedido a la que se refiere el código: la de una tienda. */
export interface PartRef {
  id: string;
  code: string;
  storeName: string;
}

export type PartResolution = { ok: true; part: PartRef } | { ok: false; message: string };

/**
 * Elige la parte. Con el código de una parte, esa. Con el del pedido, la única
 * parte si tiene una; si tiene varias, hay que decir cuál. Sin base.
 */
export function pickPart(code: string, parts: PartRef[]): PartResolution {
  const limpio = code.trim().toUpperCase();
  const exacta = parts.find((p) => p.code.toUpperCase() === limpio);
  if (exacta) return { ok: true, part: exacta };
  if (parts.length === 1) return { ok: true, part: parts[0] };
  if (parts.length === 0) return { ok: false, message: 'No encontramos ese pedido.' };
  return {
    ok: false,
    message: `El pedido tiene una parte por tienda; di de cuál es el caso: ${parts
      .map((p) => `${p.code} (${p.storeName})`)
      .join(', ')}.`,
  };
}

/**
 * Las partes de un pedido por su código o el de una de sus partes, solo las que
 * puede ver quien pregunta: las de sus pedidos (comprador) o las de sus tiendas
 * (tendero). Un pedido ajeno sale vacío, como uno que no existe: el mensaje de
 * «di cuál parte» no puede nombrar tiendas de un pedido de otra persona.
 */
export async function loadParts(
  service: SupabaseClient<any>,
  code: string,
  who: { buyerId: string } | { storeIds: string[] }
): Promise<PartRef[]> {
  const orderCode = orderCodeFrom(code);
  if (!orderCode) return [];
  if ('storeIds' in who && who.storeIds.length === 0) return [];
  let query = service
    .from('store_orders')
    .select('id, code, split_index, store_id, stores ( name ), orders!inner ( code, buyer_id )')
    .eq('orders.code', orderCode);
  query = 'buyerId' in who ? query.eq('orders.buyer_id', who.buyerId) : query.in('store_id', who.storeIds);
  const { data, error } = await query.order('split_index');
  if (error) throw new Error(`No se pudo leer el pedido: ${error.message}`);
  return (data ?? []).map((p: any) => ({ id: p.id, code: p.code, storeName: p.stores?.name ?? '' }));
}

export interface OrderLine {
  id: string;
  name: string;
  quantity: number;
}

export type ItemMatch =
  | { ok: true; items: { orderItemId: string; quantity: number }[] }
  | { ok: false; message: string };

/**
 * Los productos que se reclaman, por su nombre como lo dice la persona. Sin base.
 * Primero el nombre exacto (sin tildes ni mayúsculas); si no, el único que lo
 * contenga. Sin cantidad, la cantidad completa de esa línea.
 */
export function matchItems(lines: OrderLine[], requested: { producto: string; cantidad?: number }[]): ItemMatch {
  const items: { orderItemId: string; quantity: number }[] = [];
  const nombres = lines.map((l) => l.name).join(', ');
  for (const r of requested) {
    const buscado = normalizeText(r.producto).trim();
    const exactas = lines.filter((l) => normalizeText(l.name).trim() === buscado);
    const candidatas = exactas.length ? exactas : lines.filter((l) => normalizeText(l.name).includes(buscado));
    if (candidatas.length !== 1) {
      return {
        ok: false,
        message:
          candidatas.length === 0
            ? `«${r.producto}» no está en esa parte del pedido. Sus productos son: ${nombres}.`
            : `«${r.producto}» coincide con varios productos: ${candidatas.map((c) => c.name).join(', ')}. Di cuál.`,
      };
    }
    const linea = candidatas[0];
    if (items.some((i) => i.orderItemId === linea.id)) continue;
    items.push({ orderItemId: linea.id, quantity: r.cantidad ?? linea.quantity });
  }
  return { ok: true, items };
}

/** Quién atiende el caso y en cuánto, para decírselo a la persona. */
export function whoHandles(reason: PqrsReason, hasStore: boolean, storeResponseHours: number): string {
  if (reason.routesToStore && hasStore) {
    return `Primero responde la tienda, que tiene ${storeResponseHours} horas. Si no responde o no acepta, lo decide MercaMesa.`;
  }
  return 'Lo atiende el equipo de MercaMesa.';
}

/** Los motivos, para la descripción de la herramienta: llave, para quién y qué pide. */
export function reasonsCatalog(): string {
  return PQRS_REASONS.map((r) => {
    const pide = [
      r.order === 'required' ? 'pedido' : r.order === 'optional' ? 'pedido opcional' : null,
      r.items === 'required' ? 'productos' : null,
      r.photo ? 'foto' : null,
    ].filter(Boolean);
    return `${r.key} (${r.openedBy === 'buyer' ? 'comprador' : 'tendero'}${pide.length ? `; pide ${pide.join(', ')}` : ''})`;
  }).join('; ');
}

/**
 * Si esta persona ya dejó este mensaje en este caso (un reintento de Meteor). Se
 * busca también por el caso: con solo la clave, repetir una clave propia con el
 * código de un caso ajeno devolvía ese caso sin comprobar quién pregunta.
 */
export async function isRepeatedCaseMessage(
  service: SupabaseClient<any>,
  q: { caseId: string; authorId: string; key: string }
): Promise<boolean> {
  const { data, error } = await service
    .from('pqrs_messages')
    .select('id')
    .eq('pqrs_id', q.caseId)
    .eq('author_id', q.authorId)
    .eq('client_idempotency_key', q.key)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

/** El caso por su código. No comprueba el acceso: lo hace quien escribe o lee el caso. Lanza 404 si no existe. */
export async function caseIdByCode(service: SupabaseClient<any>, code: string): Promise<string> {
  const { data, error } = await service.from('pqrs').select('id').eq('code', code.trim().toUpperCase()).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new PqrsInputError('No encontramos ese caso.', 404);
  return data.id;
}
