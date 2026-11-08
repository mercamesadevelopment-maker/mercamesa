import type { SupabaseClient } from '@supabase/supabase-js';
import { createNotification } from '@/lib/notifications/create-notification';
import { activeAdminIds, storeTeamIds } from '@/lib/notifications/recipients';
import { createPhotoUploadTicket, movePhotos, signPhotoPaths, type UploadTicket } from '@/lib/storage/private-photos';
import type { ReceptionInput } from './reception-rules';
import { LOGISTICS_BUCKET } from './bucket';

/**
 * La evidencia de cómo logística recibió una parte en la bahía: fotos (bucket
 * privado `logistica`), observación y si algo llegó en mal estado.
 *
 * La leen logística, el tendero de esa parte y los admins; el comprador no.
 * Todo con el cliente de servicio: quien llama ya comprobó quién pregunta.
 */

export { LOGISTICS_BUCKET };

export interface BayPhoto {
  id: string;
  /** URL firmada por una hora. `null` si no se pudo firmar: la pantalla la omite. */
  url: string | null;
  createdAt: string;
}

export interface BayReception {
  receivedAt: string;
  receivedByName: string | null;
  observation: string | null;
  damaged: boolean;
  updatedAt: string | null;
  photos: BayPhoto[];
}

const COLUMNAS = 'id, bay_received_at, bay_received_by, bay_observation, bay_damaged, bay_evidence_updated_at';

export function createReceptionUploadTicket(
  service: SupabaseClient<any>,
  userId: string,
  mimeType: string
): Promise<UploadTicket> {
  return createPhotoUploadTicket(service, LOGISTICS_BUCKET, userId, mimeType);
}

/** La recepción de cada parte que ya se recibió, por id de la parte. */
export async function loadBayReceptions(
  service: SupabaseClient<any>,
  storeOrderIds: string[]
): Promise<Map<string, BayReception>> {
  const porParte = new Map<string, BayReception>();
  if (storeOrderIds.length === 0) return porParte;

  const [{ data: partes, error }, { data: fotos }] = await Promise.all([
    service.from('store_orders').select(COLUMNAS).in('id', storeOrderIds).not('bay_received_at', 'is', null),
    service
      .from('store_order_bay_photos')
      .select('id, store_order_id, path, created_at')
      .in('store_order_id', storeOrderIds)
      .order('created_at', { ascending: true }),
  ]);
  if (error) throw new Error(`No se pudo cargar la recepción: ${error.message}`);
  if (!partes || partes.length === 0) return porParte;

  const quienes = Array.from(new Set(partes.map((p: any) => p.bay_received_by).filter(Boolean)));
  const [{ data: perfiles }, urls] = await Promise.all([
    quienes.length > 0
      ? service.from('profiles').select('id, full_name').in('id', quienes)
      : Promise.resolve({ data: [] as any[] }),
    signPhotoPaths(service, LOGISTICS_BUCKET, (fotos ?? []).map((f: any) => f.path)),
  ]);
  const nombre = new Map<string, string>((perfiles ?? []).map((p: any) => [p.id, p.full_name]));

  for (const p of partes as any[]) {
    porParte.set(p.id, {
      receivedAt: p.bay_received_at,
      receivedByName: nombre.get(p.bay_received_by) ?? null,
      observation: p.bay_observation ?? null,
      damaged: Boolean(p.bay_damaged),
      updatedAt: p.bay_evidence_updated_at ?? null,
      photos: (fotos ?? [])
        .filter((f: any) => f.store_order_id === p.id)
        .map((f: any) => ({ id: f.id, url: urls.get(f.path) ?? null, createdAt: f.created_at })),
    });
  }
  return porParte;
}

export async function getBayReception(service: SupabaseClient<any>, storeOrderId: string): Promise<BayReception | null> {
  return (await loadBayReceptions(service, [storeOrderId])).get(storeOrderId) ?? null;
}

/**
 * Guarda la evidencia: pasa las fotos a la carpeta de la parte, las registra y
 * escribe la observación. Con `receiving`, además marca la parte recibida (si
 * nadie lo hizo antes). Devuelve si con esto se marcó por primera vez el mal
 * estado, para avisar una sola vez.
 *
 * Las rutas ya vienen comprobadas como propias (`areOwnUploads`).
 */
export async function saveBayEvidence(
  service: SupabaseClient<any>,
  params: { storeOrderId: string; userId: string; input: ReceptionInput; receiving: boolean }
): Promise<{ newlyDamaged: boolean }> {
  const { storeOrderId, userId, input } = params;

  const { data: antes } = await service.from('store_orders').select('bay_damaged').eq('id', storeOrderId).maybeSingle();

  const movidas = await movePhotos(service, LOGISTICS_BUCKET, { userId, paths: input.photos, folder: storeOrderId });
  if (movidas.length > 0) {
    const { error } = await service.from('store_order_bay_photos').insert(
      movidas.map((f) => ({ store_order_id: storeOrderId, path: f.path, mime_type: f.mimeType, uploaded_by: userId }))
    );
    if (error) throw new Error(`No se pudieron registrar las fotos: ${error.message}`);
  }

  const ahora = new Date().toISOString();
  const cambios: Record<string, unknown> = {
    bay_observation: input.observation,
    bay_damaged: input.damaged,
    bay_evidence_updated_at: ahora,
  };

  if (params.receiving) {
    // Dos toques a la vez: la recepción es del primero, la evidencia queda igual.
    const { data: recibida } = await service
      .from('store_orders')
      .update({ ...cambios, bay_received_at: ahora, bay_received_by: userId })
      .eq('id', storeOrderId)
      .is('bay_received_at', null)
      .select('id');
    if (!recibida || recibida.length === 0) {
      await service.from('store_orders').update(cambios).eq('id', storeOrderId);
    }
  } else {
    const { error } = await service.from('store_orders').update(cambios).eq('id', storeOrderId);
    if (error) throw new Error(`No se pudo guardar la observación: ${error.message}`);
  }

  return { newlyDamaged: input.damaged && !antes?.bay_damaged };
}

/**
 * Avisa al tendero de esa parte y a los admins que algo llegó en mal estado.
 * Nunca lanza: la recepción ya quedó guardada.
 */
export async function notifyDamagedPart(
  service: SupabaseClient<any>,
  params: { storeOrderId: string; storeId: string; storeName: string; orderCode: string; observation: string; actorId: string }
): Promise<void> {
  try {
    const [equipo, admins] = await Promise.all([storeTeamIds(service, params.storeId), activeAdminIds(service)]);
    const destinatarios = Array.from(new Set([...equipo, ...admins])).filter((id) => id !== params.actorId);

    await createNotification({
      type: 'bay_reception_damaged',
      title: `Pedido ${params.orderCode}: llegó algo en mal estado`,
      message: `Logística recibió la parte de ${params.storeName} con novedad: ${params.observation}`,
      entityType: 'store_order',
      entityId: params.storeOrderId,
      createdBy: params.actorId,
      recipientUserIds: destinatarios,
    });
  } catch (error) {
    console.error('[logística] no se pudo avisar del mal estado', error);
  }
}
