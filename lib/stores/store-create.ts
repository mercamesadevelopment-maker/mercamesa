import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database_generated';
import { toE164 } from '@/lib/phone/phone';
import { getPublicSupabaseAnonKey, getPublicSupabaseUrl } from '@/lib/env';
import { parseCategoryIds, setStoreCategories, CategoryLinksError } from './category-links';
import { validateStoreFields } from './validate-store';
import { parsePickupAddress } from './pickup-address';
import { processStoreImage } from './store-images';
import { storeError, type StoreResult } from './store-result';

type StoreInsert = Database['public']['Tables']['stores']['Insert'];

/** El rol `store_owner`: quien queda como dueño con el correo de contacto. */
const STORE_OWNER_ROLE_ID = '5cd37ab3-c7e2-40a7-8677-363935b51e5a';

const esVerdadero = (v: unknown) => v === true || v === 'true';

/**
 * Valida el cuerpo del alta y arma la fila, sin tocar la base. Las imágenes se
 * agregan después, cuando ya se generaron sus variantes.
 */
export function buildStoreInsert(
  body: Record<string, any>,
  storeId: string
): { insert: StoreInsert; categoryIds: string[] | null } | { error: string } {
  // Los teléfonos se guardan siempre en E.164 (+573001234567): Pibox recibe el
  // indicativo aparte del número, y sin un formato fijo no hay cómo separarlos.
  const phone = body.phone ? toE164(body.phone as string) : null;
  const whatsapp = body.whatsapp ? toE164(body.whatsapp as string) : null;
  if (body.phone && !phone) return { error: 'El teléfono no es un número válido.' };
  if (body.whatsapp && !whatsapp) return { error: 'El WhatsApp no es un número válido.' };

  let categoryIds: string[] | null;
  try {
    categoryIds = parseCategoryIds(body.category_ids);
  } catch (e) {
    return { error: e instanceof CategoryLinksError ? e.message : 'Categorías inválidas.' };
  }

  const name = body.name as string;
  const slug = body.slug as string;
  const marketplace_id = body.marketplace_id as string;
  if (!name || !slug || !marketplace_id) return { error: 'Missing required fields' };

  const description = (body.description as string) || null;
  const contact_email = (body.contact_email as string) || null;

  // Correo malformado o descripción sin límite: antes nada lo impedía, ni acá
  // ni en el formulario, así que un dato malo podía guardarse sin aviso.
  const fieldsError = validateStoreFields({ name, description, contactEmail: contact_email });
  if (fieldsError) return { error: fieldsError };

  // Dirección de recogida propia. Opcional: sin ella se recoge en la plaza.
  const recogida = parsePickupAddress(body);
  if (recogida.error) return { error: recogida.error };

  return {
    categoryIds,
    insert: {
      id: storeId,
      name,
      slug,
      marketplace_id,
      description,
      contact_name: (body.contact_name as string) || null,
      contact_email,
      phone,
      whatsapp,
      is_active: esVerdadero(body.is_active),
      is_verified: false,
      // Una tienda puede ser mayorista y minorista a la vez, así que son dos
      // banderas independientes; por defecto, al detal.
      is_wholesale: esVerdadero(body.is_wholesale),
      is_retail: body.is_retail === undefined ? true : esVerdadero(body.is_retail),
      cover_image_url: null,
      logo_url: null,
      business_hours: body.business_hours || null,
      ...recogida.fields,
    },
  };
}

/**
 * Crea una tienda (`POST /api/stores`). Quien llama ya comprobó el permiso
 * `stores.create`.
 *
 * Después de crearla, sus categorías y, si trae correo de contacto, su dueño:
 * con cuenta queda en el equipo; sin cuenta, se le invita.
 */
export async function createStore(
  supabase: SupabaseClient<any>,
  service: SupabaseClient<any>,
  userId: string,
  body: Record<string, any>,
  origin: string
): Promise<StoreResult> {
  const storeId = (body.id as string) || crypto.randomUUID();
  const armado = buildStoreInsert(body, storeId);
  if ('error' in armado) return storeError(400, armado.error);
  const { insert, categoryIds } = armado;

  if (insert.contact_email) {
    const { data: existingStore, error: checkError } = await supabase
      .from('stores')
      .select('id')
      .eq('contact_email', insert.contact_email)
      .maybeSingle();
    if (checkError) throw checkError;
    if (existingStore) return storeError(400, 'El correo de contacto ya está registrado en otra tienda.');
  }

  if (body.cover_image_url) {
    insert.cover_image_url = body.cover_image_url as string;
    await processStoreImage(supabase, insert.cover_image_url, 'cover');
  }
  if (body.logo_url) {
    insert.logo_url = body.logo_url as string;
    await processStoreImage(supabase, insert.logo_url, 'logo');
  }

  const { data, error } = await supabase.from('stores').insert(insert).select().single();
  if (error) return storeError(400, error.message);

  // Las categorías van en `store_category_links`, después de crear la tienda.
  if (categoryIds !== null && categoryIds.length > 0) {
    try {
      await setStoreCategories(supabase, storeId, categoryIds);
    } catch (e) {
      // La tienda ya quedó creada: no se deshace por unas categorías, pero
      // tampoco se calla, porque el admin no vería lo que eligió.
      return storeError(
        400,
        e instanceof CategoryLinksError
          ? `La tienda se creó, pero sus categorías no se pudieron guardar: ${e.message}`
          : 'La tienda se creó, pero sus categorías no se pudieron guardar.'
      );
    }
  }

  if (insert.contact_email) {
    await assignContactOwner(supabase, service, {
      storeId,
      email: insert.contact_email,
      contactName: insert.contact_name ?? null,
      storeName: insert.name,
      invitedBy: userId,
      origin,
    });
  }

  return { status: 201, body: { data } };
}

/**
 * El correo de contacto queda como dueño: con cuenta, entra al equipo y se le
 * avisa; sin cuenta, se le invita. Ninguno de los dos frena el alta.
 *
 * Buscar a otra persona por correo e invitarla es cosa del servidor: un usuario
 * no lee perfiles ajenos ni invitaciones.
 */
async function assignContactOwner(
  supabase: SupabaseClient<any>,
  service: SupabaseClient<any>,
  input: { storeId: string; email: string; contactName: string | null; storeName: string; invitedBy: string; origin: string }
) {
  const { storeId, email, contactName, storeName, invitedBy, origin } = input;

  const { data: profile } = await service.from('profiles').select('id').eq('email', email).maybeSingle();

  if (profile) {
    await supabase.from('store_members').insert({
      store_id: storeId,
      user_id: profile.id,
      role_id: STORE_OWNER_ROLE_ID,
      invited_by: invitedBy,
    });

    try {
      await fetch(`${getPublicSupabaseUrl()}/functions/v1/notify-store-assignment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getPublicSupabaseAnonKey()}`,
        },
        body: JSON.stringify({
          email,
          fullName: contactName || 'Miembro',
          storeName,
          roleLabel: 'Dueño de Tienda',
          loginUrl: `${origin}/seller/onboarding`,
        }),
      });
    } catch (efErr) {
      console.error('Error invoking notify-store-assignment edge function:', efErr);
    }
    return;
  }

  try {
    const { error: inviteError } = await service.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/accept-invite`,
    });
    if (inviteError) return;

    const expires = new Date();
    expires.setDate(expires.getDate() + 7);
    await service.from('invitations').insert({
      email,
      store_id: storeId,
      role: STORE_OWNER_ROLE_ID,
      invitation_type: 'store_member',
      invited_by: invitedBy,
      token: crypto.randomUUID(),
      expires_at: expires.toISOString(),
    });
  } catch (inviteErr) {
    console.error('Error inviting user:', inviteErr);
  }
}
