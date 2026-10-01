import type { SupabaseClient } from '@supabase/supabase-js';
import { getPqrsReason, type PqrsLiable } from './reasons';
import { viewerOf, type PqrsActor } from './actor';
import { areOwnUploads, attachUploads, FOTO_NO_VALIDA } from './storage';
import { notifyPqrs } from './notify';
import { PqrsInputError } from './errors';
import { MAX_DESCRIPTION, MAX_PHOTOS } from './rules';
import type { PqrsOutcome, PqrsViewer } from './types';

/**
 * Lo que se le puede hacer a una PQRS ya radicada: escribir, responder como
 * tienda, resolver.
 */

interface PqrsRow {
  id: string;
  code: string;
  reason: string;
  status: string;
  opened_by: string;
  opened_as: string;
  store_id: string | null;
}

async function loadForAction(
  service: SupabaseClient<any>,
  actor: PqrsActor,
  id: string
): Promise<{ pqrs: PqrsRow; viewer: PqrsViewer }> {
  const { data: pqrs } = await service
    .from('pqrs')
    .select('id, code, reason, status, opened_by, opened_as, store_id')
    .eq('id', id)
    .maybeSingle();

  const viewer = pqrs ? viewerOf(actor, pqrs) : null;
  // Sin acceso se responde igual que si no existiera.
  if (!pqrs || !viewer) throw new PqrsInputError('No encontramos esa PQRS.', 404);

  return { pqrs, viewer };
}

/** A quién avisarle de algo que hizo `viewer`: a los demás que ven el caso. */
function others(pqrs: PqrsRow, viewer: PqrsViewer): ('opener' | 'store' | 'admins')[] {
  const tiendaLoVe = pqrs.opened_as === 'seller' || Boolean(getPqrsReason(pqrs.reason)?.storeSees);
  const todos: ('opener' | 'store' | 'admins')[] = ['opener', 'admins'];
  if (tiendaLoVe && pqrs.opened_as === 'buyer') todos.push('store');

  if (viewer === 'admin') return todos.filter((a) => a !== 'admins');
  if (viewer === 'buyer') return todos.filter((a) => a !== 'opener');
  // Tendero: si el caso lo abrió su tienda, él es el «opener».
  return pqrs.opened_as === 'seller' ? ['admins'] : ['opener', 'admins'];
}

export async function addPqrsMessage(
  service: SupabaseClient<any>,
  actor: PqrsActor,
  id: string,
  input: { body?: unknown; isInternal?: unknown; attachments?: unknown }
): Promise<void> {
  const { pqrs, viewer } = await loadForAction(service, actor, id);

  if (pqrs.status === 'resolved' && viewer !== 'admin') {
    throw new PqrsInputError('Este caso ya está resuelto. Si el problema sigue, radica uno nuevo.', 409);
  }

  const body = String(input.body ?? '').trim();
  const attachments = Array.isArray(input.attachments) ? (input.attachments as string[]) : [];

  if (!body) throw new PqrsInputError('Escribe un mensaje.');
  if (body.length > MAX_DESCRIPTION) {
    throw new PqrsInputError(`El mensaje no puede pasar de ${MAX_DESCRIPTION} caracteres.`);
  }
  if (attachments.length > MAX_PHOTOS) throw new PqrsInputError(`Puedes adjuntar hasta ${MAX_PHOTOS} fotos.`);
  if (!areOwnUploads(actor.userId, attachments)) throw new PqrsInputError(FOTO_NO_VALIDA);

  // Solo un admin deja notas internas; de cualquier otro, la marca se ignora.
  const isInternal = viewer === 'admin' && input.isInternal === true;

  const { data: mensaje, error } = await service
    .from('pqrs_messages')
    .insert({
      pqrs_id: id,
      author_id: actor.userId,
      author_as: viewer,
      body,
      is_internal: isInternal,
    })
    .select('id')
    .single();

  if (error || !mensaje) throw new Error(`No se pudo guardar el mensaje: ${error?.message ?? ''}`);

  try {
    await attachUploads(service, { pqrsId: id, messageId: mensaje.id, userId: actor.userId, paths: attachments });
  } catch (err) {
    await service.from('pqrs_messages').delete().eq('id', mensaje.id);
    throw err instanceof Error ? new PqrsInputError(err.message) : err;
  }

  // Para que el listado ordene por actividad.
  await service.from('pqrs').update({ updated_at: new Date().toISOString() }).eq('id', id);

  if (!isInternal) {
    await notifyPqrs(service, {
      pqrs,
      audiences: others(pqrs, viewer),
      actorId: actor.userId,
      title: 'Nuevo mensaje en una PQRS',
      message: 'Hay un mensaje nuevo en el caso.',
    });
  }
}

/**
 * La tienda responde un caso de un comprador.
 *
 * Si acepta, el caso queda aprobado sin pasar por el admin: la tienda es quien
 * asume el costo y ya dijo que sí. Si rechaza, decide MercaMesa.
 */
export async function respondAsStore(
  service: SupabaseClient<any>,
  actor: PqrsActor,
  id: string,
  input: { decision?: unknown; notes?: unknown }
): Promise<void> {
  const { pqrs, viewer } = await loadForAction(service, actor, id);

  // El admin no responde por la tienda: para eso tiene «resolver».
  if (viewer !== 'seller' || pqrs.opened_as !== 'buyer') {
    throw new PqrsInputError('Solo el equipo de la tienda puede responder este caso.', 403);
  }

  const acepta = input.decision === 'accept';
  if (!acepta && input.decision !== 'reject') throw new PqrsInputError('Indica si aceptas o no el reclamo.');

  const notes = String(input.notes ?? '').trim();
  if (!acepta && notes.length < 10) {
    throw new PqrsInputError('Explica por qué no aceptas el reclamo: lo leerán el comprador y MercaMesa.');
  }

  const ahora = new Date().toISOString();
  const cambio = acepta
    ? {
        status: 'resolved',
        outcome: 'approved',
        liable: getPqrsReason(pqrs.reason)?.defaultLiable ?? 'store',
        store_response: 'accepted',
        resolved_by: actor.userId,
        resolved_at: ahora,
        resolution_notes: notes || 'La tienda aceptó el reclamo.',
      }
    : { status: 'in_review', store_response: 'rejected' };

  // El `eq` sobre el estado es lo que evita que dos respuestas a la vez —o una
  // respuesta y el vencimiento del plazo— pisen la una a la otra.
  const { data: actualizado, error } = await service
    .from('pqrs')
    .update({ ...cambio, store_responded_at: ahora, store_responded_by: actor.userId })
    .eq('id', id)
    .eq('status', 'awaiting_store')
    .select('id');

  if (error) throw new Error(`No se pudo guardar la respuesta: ${error.message}`);
  if (!actualizado?.length) {
    throw new PqrsInputError('Este caso ya no está esperando a la tienda.', 409);
  }

  await service.from('pqrs_messages').insert({
    pqrs_id: id,
    author_id: actor.userId,
    author_as: 'seller',
    body: acepta
      ? notes || 'La tienda aceptó el reclamo.'
      : `La tienda no aceptó el reclamo: ${notes}`,
  });

  await notifyPqrs(service, {
    pqrs,
    audiences: acepta ? ['opener'] : ['opener', 'admins'],
    actorId: actor.userId,
    title: acepta ? 'La tienda aceptó el reclamo' : 'La tienda respondió el reclamo',
    message: acepta
      ? 'La tienda aceptó el reclamo y el caso quedó aprobado.'
      : 'La tienda no aceptó el reclamo. El caso pasa a revisión de MercaMesa, que tomará la decisión.',
  });
}

const OUTCOMES: PqrsOutcome[] = ['approved', 'rejected', 'answered'];
const LIABLES: PqrsLiable[] = ['store', 'logistics', 'platform', 'buyer'];

const TITULO_RESULTADO: Record<PqrsOutcome, string> = {
  approved: 'PQRS aprobada',
  rejected: 'PQRS resuelta: no procede',
  answered: 'PQRS respondida',
};

/** El admin cierra el caso. */
export async function resolvePqrs(
  service: SupabaseClient<any>,
  actor: PqrsActor,
  id: string,
  input: { outcome?: unknown; liable?: unknown; notes?: unknown }
): Promise<void> {
  const { pqrs, viewer } = await loadForAction(service, actor, id);
  if (viewer !== 'admin') throw new PqrsInputError('Solo un administrador puede resolver el caso.', 403);

  const outcome = input.outcome as PqrsOutcome;
  if (!OUTCOMES.includes(outcome)) throw new PqrsInputError('Indica el resultado del caso.');

  const notes = String(input.notes ?? '').trim();
  if (notes.length < 10) {
    throw new PqrsInputError('Escribe la respuesta: es lo que lee quien radicó el caso.');
  }

  const liable = input.liable ? (input.liable as PqrsLiable) : null;
  if (liable && !LIABLES.includes(liable)) throw new PqrsInputError('El responsable no es válido.');

  const { data: actualizado, error } = await service
    .from('pqrs')
    .update({
      status: 'resolved',
      outcome,
      liable: outcome === 'approved' ? liable : null,
      resolved_by: actor.userId,
      resolved_at: new Date().toISOString(),
      resolution_notes: notes,
    })
    .eq('id', id)
    .neq('status', 'resolved')
    .select('id');

  if (error) throw new Error(`No se pudo resolver el caso: ${error.message}`);
  if (!actualizado?.length) throw new PqrsInputError('Este caso ya estaba resuelto.', 409);

  await service.from('pqrs_messages').insert({
    pqrs_id: id,
    author_id: actor.userId,
    author_as: 'admin',
    body: notes,
  });

  await notifyPqrs(service, {
    pqrs,
    audiences: others(pqrs, 'admin'),
    actorId: actor.userId,
    title: TITULO_RESULTADO[outcome],
    message: 'MercaMesa resolvió el caso. Entra a verlo para leer la respuesta.',
  });
}
