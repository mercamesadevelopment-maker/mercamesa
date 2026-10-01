import type { SupabaseClient } from '@supabase/supabase-js';
import { getPqrsReason } from './reasons';
import { validateNewPqrs } from './rules';
import { loadOrderContext } from './order-context';
import { loadPqrsSettings } from './settings';
import { areOwnUploads, attachUploads, FOTO_NO_VALIDA } from './storage';
import { notifyPqrs } from './notify';
import type { PqrsActor } from './actor';
import { PqrsInputError } from './errors';
import type { NewPqrsInput } from './types';

const HORA = 60 * 60 * 1000;

/**
 * Radica una PQRS.
 *
 * El puesto de quien radica (comprador o tendero) no viene del navegador: lo
 * dice el motivo, y acá se comprueba que quien pregunta de verdad ocupe ese
 * puesto frente al pedido o la tienda.
 */
export async function createPqrs(
  service: SupabaseClient<any>,
  actor: PqrsActor,
  input: NewPqrsInput
): Promise<{ id: string; code: string }> {
  const reason = getPqrsReason(String(input.reason ?? ''));
  if (!reason) throw new PqrsInputError('Elige un motivo.');

  const order = input.storeOrderId ? await loadOrderContext(service, input.storeOrderId) : null;
  if (input.storeOrderId && !order) throw new PqrsInputError('No encontramos ese pedido.', 404);

  let storeId: string | null = order?.storeId ?? null;

  if (reason.openedBy === 'buyer') {
    // Un pedido ajeno se responde igual que uno que no existe: no se confirma
    // que el pedido es de otra persona.
    if (order && order.buyerId !== actor.userId) throw new PqrsInputError('No encontramos ese pedido.', 404);
  } else {
    storeId = storeId ?? input.storeId ?? null;
    if (!storeId) throw new PqrsInputError('Indica la tienda.');
    if (!actor.storeIds.includes(storeId)) {
      throw new PqrsInputError('Solo el equipo de la tienda puede radicar este caso.', 403);
    }
    if (reason.order === 'required' && order && !order.buyerId) {
      throw new PqrsInputError('Ese pedido fue una venta de mostrador: no tiene un comprador registrado.');
    }
  }

  const settings = await loadPqrsSettings(service);
  const items = Array.isArray(input.items) ? input.items : [];
  const attachments = Array.isArray(input.attachments) ? input.attachments : [];

  const problema = validateNewPqrs({
    reason,
    order,
    description: String(input.description ?? ''),
    items: items.map((i) => ({ orderItemId: String(i.orderItemId), quantity: Number(i.quantity) })),
    photos: attachments.length,
    claimWindowHours: settings.claimWindowHours,
  });
  if (problema) throw new PqrsInputError(problema);
  if (!areOwnUploads(actor.userId, attachments)) throw new PqrsInputError(FOTO_NO_VALIDA);

  const esperaTienda = reason.routesToStore && Boolean(storeId);

  const { data: pqrs, error } = await service
    .from('pqrs')
    .insert({
      kind: reason.kind,
      reason: reason.key,
      opened_by: actor.userId,
      opened_as: reason.openedBy,
      store_id: storeId,
      order_id: order?.orderId ?? null,
      store_order_id: order?.storeOrderId ?? null,
      buyer_id: reason.openedBy === 'buyer' ? actor.userId : order?.buyerId ?? null,
      subject: reason.label,
      description: String(input.description).trim(),
      status: esperaTienda ? 'awaiting_store' : 'in_review',
      store_response_due_at: esperaTienda
        ? new Date(Date.now() + settings.storeResponseHours * HORA).toISOString()
        : null,
      settings_id: settings.id,
    })
    .select('id, code, opened_by, store_id')
    .single();

  if (error || !pqrs) {
    // El índice único: ya hay un caso abierto por este motivo sobre este pedido.
    if (error?.code === '23505') {
      throw new PqrsInputError(
        'Ya tienes un caso abierto por este motivo sobre este pedido. Escríbenos ahí.',
        409
      );
    }
    throw new Error(`No se pudo radicar la PQRS: ${error?.message ?? ''}`);
  }

  try {
    if (items.length > 0 && order) {
      const { error: itemsError } = await service.from('pqrs_items').insert(
        items.map((i) => {
          const linea = order.items.find((l) => l.id === i.orderItemId)!;
          return {
            pqrs_id: pqrs.id,
            order_item_id: linea.id,
            quantity: Number(i.quantity),
            catalog_name: linea.name,
            unit_name: linea.unit,
            unit_price: linea.unitPrice,
          };
        })
      );
      if (itemsError) throw new Error(itemsError.message);
    }

    await attachUploads(service, { pqrsId: pqrs.id, userId: actor.userId, paths: attachments });
  } catch (err) {
    // Un caso a medias —sin sus productos o sin la foto que el motivo exige— es
    // peor que ninguno: se borra y se le pide a quien radica que reintente.
    await service.from('pqrs').delete().eq('id', pqrs.id);
    throw err instanceof Error ? new PqrsInputError(err.message) : err;
  }

  await notifyPqrs(service, {
    pqrs,
    audiences: esperaTienda ? ['store'] : reason.storeSees && reason.openedBy === 'buyer' ? ['admins', 'store'] : ['admins'],
    actorId: actor.userId,
    title: 'Nueva PQRS',
    message: esperaTienda
      ? `Un comprador radicó un caso sobre un pedido de tu tienda: «${reason.label}». Tienes ${settings.storeResponseHours} horas para responder; después lo decide MercaMesa.`
      : `Se radicó un caso: «${reason.label}».`,
  });

  return { id: pqrs.id, code: pqrs.code };
}
