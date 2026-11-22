import type { SupabaseClient } from '@supabase/supabase-js';
import { LOGISTICS_BUCKET } from '@/lib/logistics/bucket';
import { createPhotoUploadTicket, movePhotos, signPhotoPaths, type UploadTicket } from '@/lib/storage/private-photos';
import { storeMustPhotograph, type StoreEvidenceInput } from './store-evidence-rules';

/**
 * La evidencia que deja el tendero al marcar «Listo Recogida» cuando la parte
 * no la recibe logística: fotos (bucket privado `logistica`, `source = 'store'`)
 * y una observación. Las reglas están en `store-evidence-rules.ts`.
 *
 * La leen el equipo de la tienda y los admins; el comprador no. Todo con el
 * cliente de servicio: quien llama ya comprobó quién pregunta.
 */

export interface StoreEvidence {
  at: string;
  byName: string | null;
  observation: string | null;
  photos: { id: string; url: string | null; createdAt: string }[];
}

/** Si a esta parte le toca al tendero la foto al marcar «Listo Recogida». */
export async function storeOrderNeedsEvidence(service: SupabaseClient<any>, storeOrderId: string): Promise<boolean> {
  const { data: parte, error } = await service
    .from('store_orders')
    .select(
      'id, orders!inner ( fulfillment, runner_required, logistics_required ), stores!inner ( address, latitude, longitude, marketplaces ( logistics_enabled ) )'
    )
    .eq('id', storeOrderId)
    .maybeSingle();
  if (error) throw new Error(`No se pudo leer el pedido: ${error.message}`);
  if (!parte) return false;

  const o = (parte as any).orders;
  const s = (parte as any).stores;
  return storeMustPhotograph({
    consolidated: o?.fulfillment === 'consolidated',
    config: { runnerRequired: Boolean(o?.runner_required), logisticsRequired: Boolean(o?.logistics_required) },
    marketplaceHasLogistics: Boolean(s?.marketplaces?.logistics_enabled),
    ownPickup: Boolean(String(s?.address ?? '').trim() || (s?.latitude != null && s?.longitude != null)),
  });
}

export function createStoreEvidenceUploadTicket(
  service: SupabaseClient<any>,
  userId: string,
  mimeType: string
): Promise<UploadTicket> {
  return createPhotoUploadTicket(service, LOGISTICS_BUCKET, userId, mimeType);
}

/** Guarda las fotos (ya comprobadas como propias con `areOwnUploads`) y la observación. */
export async function saveStoreEvidence(
  service: SupabaseClient<any>,
  params: { storeOrderId: string; userId: string; input: StoreEvidenceInput }
): Promise<void> {
  const { storeOrderId, userId, input } = params;
  const movidas = await movePhotos(service, LOGISTICS_BUCKET, {
    userId,
    paths: input.photos,
    folder: `${storeOrderId}/tienda`,
  });
  if (movidas.length > 0) {
    const { error } = await service.from('store_order_bay_photos').insert(
      movidas.map((f) => ({
        store_order_id: storeOrderId,
        path: f.path,
        mime_type: f.mimeType,
        uploaded_by: userId,
        source: 'store',
      }))
    );
    if (error) throw new Error(`No se pudieron registrar las fotos: ${error.message}`);
  }

  const { error } = await service
    .from('store_orders')
    .update({ store_evidence_at: new Date().toISOString(), store_evidence_by: userId, store_observation: input.observation })
    .eq('id', storeOrderId);
  if (error) throw new Error(`No se pudo guardar la evidencia: ${error.message}`);
}

/** La evidencia de la tienda, o `null` si no dejó. */
export async function loadStoreEvidence(service: SupabaseClient<any>, storeOrderId: string): Promise<StoreEvidence | null> {
  const [{ data: parte }, { data: fotos }] = await Promise.all([
    service.from('store_orders').select('store_evidence_at, store_evidence_by, store_observation').eq('id', storeOrderId).maybeSingle(),
    service
      .from('store_order_bay_photos')
      .select('id, path, created_at')
      .eq('store_order_id', storeOrderId)
      .eq('source', 'store')
      .order('created_at', { ascending: true }),
  ]);
  if (!parte?.store_evidence_at) return null;

  const [{ data: perfil }, urls] = await Promise.all([
    parte.store_evidence_by
      ? service.from('profiles').select('full_name').eq('id', parte.store_evidence_by).maybeSingle()
      : Promise.resolve({ data: null as any }),
    signPhotoPaths(service, LOGISTICS_BUCKET, (fotos ?? []).map((f: any) => f.path)),
  ]);

  return {
    at: parte.store_evidence_at,
    byName: perfil?.full_name ?? null,
    observation: parte.store_observation ?? null,
    photos: (fotos ?? []).map((f: any) => ({ id: f.id, url: urls.get(f.path) ?? null, createdAt: f.created_at })),
  };
}
