import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseImageUrl, PRESET_COVER_DETAIL, PRESET_LOGO } from '@/lib/supabase/supabase-image';
import { canManageStore } from '@/lib/auth/can-manage-store';
import { withFlatCategories } from './category-links';
import { toPublicStore } from './public-store';
import { storeError, type StoreResult } from './store-result';

const SELECT_LISTADO = `
  *,
  marketplaces ( name ),
  store_category_links ( store_categories ( id, name ) ),
  store_reviews ( stars ),
  store_members (
    id,
    role_id,
    roles ( name, label ),
    profiles!user_id ( id, full_name, email )
  ),
  store_documents (
    id,
    document_type_id,
    status
  )
`;

/** El mismo, con `!inner` en los miembros para filtrar a las tiendas del usuario. */
const SELECT_PROPIAS = SELECT_LISTADO.replace('store_members (', 'store_members!inner (');

/**
 * El listado de tiendas (`GET /api/stores`).
 *
 * Lo consumen el panel del admin, el del tendero y también páginas públicas (la
 * lista de tiendas, las promociones, el filtro de pedidos), y a todos les
 * devolvía lo mismo: cualquiera, sin sesión, recibía el correo de contacto y la
 * dirección de recogida de cada tienda.
 *
 * La fila completa es para quien gestiona: el permiso `stores` (el mismo que
 * protege /admin/stores) o las tiendas propias (`member_only`, que ya viene
 * filtrado a las del usuario). El resto recibe la vista pública.
 */
export async function listStores(
  supabase: SupabaseClient<any>,
  params: URLSearchParams,
  userId: string | null
): Promise<StoreResult> {
  const active = params.get('is_active');
  const marketplaceId = params.get('marketplace_id');
  const memberOnly = params.get('member_only') === 'true' && !!userId;

  let query = supabase.from('stores').select(memberOnly ? SELECT_PROPIAS : SELECT_LISTADO);
  if (active !== null) query = query.eq('is_active', active === 'true');
  if (marketplaceId) query = query.eq('marketplace_id', marketplaceId);
  if (memberOnly) query = query.eq('store_members.user_id', userId);

  const { data, error } = await query;
  if (error) return storeError(400, error.message);

  const { data: requiredDocumentTypes, error: typesError } = await supabase
    .from('document_types')
    .select('id, name, slug, is_required')
    .eq('is_required', true);
  if (typesError) return storeError(400, typesError.message);

  const tiendas = (data ?? []).map(toListedStore);

  let gestiona = false;
  if (userId) {
    if (memberOnly) {
      gestiona = true;
    } else {
      const { data: puedeVerTiendas } = await supabase.rpc('has_permission', {
        module_key: 'stores',
        action_name: 'read',
      });
      gestiona = puedeVerTiendas === true;
    }
  }

  return gestiona
    ? { status: 200, body: { data: tiendas, requiredDocumentTypes } }
    : { status: 200, body: { data: tiendas.map(toPublicStore), requiredDocumentTypes: [] } };
}

/**
 * Una tienda del listado, lista para pintar.
 *
 * Con sus categorías: el modal del admin se llena con esta respuesta, y sin
 * ellas guardaba la lista vacía y le borraba las categorías a la tienda.
 */
export function toListedStore({ store_reviews, ...store }: any) {
  return {
    ...withFlatCategories(store),
    // La calificación sale de las reseñas, no de `reputation_score`: esa columna
    // nace en 5.00, y el listado mostraba 5.0 en tiendas que nadie ha calificado.
    ...reviewSummary(store_reviews),
    logoSignedUrl: store.logo_url ? getSupabaseImageUrl('stores', store.logo_url, PRESET_LOGO) : null,
    coverSignedUrl: store.cover_image_url ? getSupabaseImageUrl('stores', store.cover_image_url, PRESET_COVER_DETAIL) : null,
  };
}

/** Cuántas reseñas tiene una tienda y su promedio; `null` si no tiene ninguna. */
export function reviewSummary(reviews: { stars: number }[] | null | undefined) {
  const lista = reviews ?? [];
  if (lista.length === 0) return { reviewCount: 0, rating: null };

  const suma = lista.reduce((acc, r) => acc + Number(r.stars), 0);
  return { reviewCount: lista.length, rating: suma / lista.length };
}

/**
 * Una tienda por id (`GET /api/stores/[id]`).
 *
 * La fila completa —correo de contacto, dirección de recogida— es para quien
 * gestiona la tienda. Antes la recibía cualquiera que supiera el id, y los ids
 * salen en la lista pública.
 */
export async function getStore(supabase: SupabaseClient<any>, storeId: string, userId: string | null): Promise<StoreResult> {
  const { data, error } = await supabase
    .from('stores')
    .select(`
      *,
      marketplaces ( name ),
      store_category_links ( store_categories ( id, name ) ),
      store_members (
        id,
        role_id,
        roles ( name, label ),
        profiles!user_id ( id, full_name, email )
      )
    `)
    .eq('id', storeId)
    .single();

  if (error) return storeError(404, error.message);

  const store = {
    ...withFlatCategories(data),
    coverSignedUrl: data.cover_image_url ? getSupabaseImageUrl('stores', data.cover_image_url, PRESET_COVER_DETAIL) : null,
    logoSignedUrl: data.logo_url ? getSupabaseImageUrl('stores', data.logo_url, PRESET_LOGO) : null,
  };

  const gestiona = !!userId && (await canManageStore(supabase, storeId, userId));
  return { status: 200, body: { data: gestiona ? store : toPublicStore(store) } };
}
