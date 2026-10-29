import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database_generated';
import { toE164 } from '@/lib/phone/phone';
import { parseCategoryIds, setStoreCategories, CategoryLinksError } from './category-links';
import { validateStoreFields } from './validate-store';
import { parsePickupAddress } from './pickup-address';
import { processStoreImage } from './store-images';
import { storeError, type StoreResult } from './store-result';

type StoreUpdate = Database['public']['Tables']['stores']['Update'];

/**
 * Campos que el tendero puede editar de su propia tienda.
 *
 * `local_address` es la ubicación DENTRO de la plaza ("Local 234, pasillo 3"),
 * no una dirección postal. La dirección de recogida —`address`, `city`,
 * `department` y sus coordenadas— se maneja aparte, en `parsePickupAddress`,
 * porque las coordenadas son números y este bucle guarda todo con `String(val)`.
 */
const MEMBER_EDITABLE_FIELDS = [
  'name',
  'description',
  'contact_name',
  'contact_email',
  'phone',
  'whatsapp',
  'local_address',
] as const;

/**
 * Si la tienda vende al por mayor, al detal o ambas. Son dos banderas y no una
 * sola opción porque en la plaza el mismo local vende un bulto y vende una
 * libra. Lo decide la tienda, no la plataforma.
 */
const SALES_TYPE_FIELDS = ['is_wholesale', 'is_retail'] as const;

/**
 * Campos reservados a la plataforma. El `slug` es la URL pública, `marketplace_id`
 * mueve la tienda de plaza (y con ello cambia el punto de recogida de los
 * envíos), y verificación y grupo son decisiones de MercaMesa. Un tendero no
 * puede tocarlos ni mandándolos a mano.
 */
const ADMIN_ONLY_FIELDS = ['slug', 'marketplace_id', 'is_verified', 'store_group_id'] as const;

/** Los teléfonos se normalizan a E.164; lo que no sea un número se rechaza. */
const PHONE_FIELDS: Record<string, string> = {
  phone: 'El teléfono no es un número válido.',
  whatsapp: 'El WhatsApp no es un número válido.',
};

/**
 * Lee el cuerpo de una edición y arma los cambios, sin tocar la base. Lo que no
 * se puede editar se descarta en silencio; lo inválido devuelve el error.
 */
export function buildStoreUpdate(
  body: Record<string, any>,
  isAdmin: boolean
): { updateData: Partial<StoreUpdate>; categoryIds: string[] | null } | { error: string } {
  const updateData: Record<string, unknown> = {};

  for (const field of MEMBER_EDITABLE_FIELDS) {
    const val = body[field];
    // `String(val)` convertía un null explícito en la cadena "null"; vaciar un
    // campo opcional debe guardarlo como null.
    if (val === undefined) continue;

    if (val === null || val === '') {
      updateData[field] = null;
      continue;
    }

    if (field in PHONE_FIELDS) {
      const e164 = toE164(String(val));
      if (!e164) return { error: PHONE_FIELDS[field] };
      updateData[field] = e164;
      continue;
    }

    updateData[field] = String(val);
  }

  // `name` es obligatorio en la tabla: no se puede vaciar.
  if (updateData.name === null) return { error: 'El nombre de la tienda es obligatorio.' };

  // Solo se valida lo que llegó: si `description` no viene, no se revalida la
  // longitud de lo que ya estaba guardado.
  const fieldsError = validateStoreFields({
    name: updateData.name as string | undefined,
    description: updateData.description as string | null | undefined,
    contactEmail: updateData.contact_email as string | null | undefined,
  });
  if (fieldsError) return { error: fieldsError };

  // La dirección de recogida la puede editar tanto el admin como el tendero:
  // sin ella una tienda independiente no puede despachar, y hacerla depender del
  // admin la dejaría sin vender mientras tanto.
  const recogida = parsePickupAddress(body);
  if (recogida.error) return { error: recogida.error };
  Object.assign(updateData, recogida.fields);

  if (isAdmin) {
    ADMIN_ONLY_FIELDS.forEach((field) => {
      const val = body[field];
      if (val === undefined) return;
      updateData[field] = field === 'is_verified' ? Boolean(val) : val || null;
    });

    // `is_active` no estaba en la lista de campos, así que el modal del admin lo
    // enviaba y la ruta lo descartaba en silencio: activar o desactivar una
    // tienda desde ahí no hacía nada.
    if (body.is_active !== undefined) updateData.is_active = Boolean(body.is_active);
  }

  SALES_TYPE_FIELDS.forEach((field) => {
    if (body[field] !== undefined) updateData[field] = Boolean(body[field]);
  });

  // Las categorías no son una columna de `stores`, así que no van en
  // `updateData`: se reconcilian aparte, después de guardar la tienda.
  let categoryIds: string[] | null;
  try {
    categoryIds = parseCategoryIds(body.category_ids);
  } catch (e) {
    return { error: e instanceof CategoryLinksError ? e.message : 'Categorías inválidas.' };
  }

  if (body.business_hours !== undefined) updateData.business_hours = body.business_hours || null;

  return { updateData: updateData as Partial<StoreUpdate>, categoryIds };
}

/** Si una imagen vive en la carpeta de la tienda. Sin esto un miembro podía apuntar su logo a un archivo de otra. */
export const isStoreImagePath = (path: unknown, storeId: string) =>
  typeof path === 'string' && path.startsWith(`imgs/${storeId}/`);

/**
 * Edita una tienda (`PUT /api/stores/[id]`). Quien llama ya comprobó que la
 * gestiona; `isAdmin` decide si entran los campos reservados a la plataforma.
 */
export async function updateStore(
  supabase: SupabaseClient<any>,
  storeId: string,
  body: Record<string, any>,
  isAdmin: boolean
): Promise<StoreResult> {
  const armado = buildStoreUpdate(body, isAdmin);
  if ('error' in armado) return storeError(400, armado.error);
  const { updateData, categoryIds } = armado;

  if (updateData.contact_email) {
    const { data: existingStore, error: checkError } = await supabase
      .from('stores')
      .select('id')
      .eq('contact_email', updateData.contact_email)
      .neq('id', storeId)
      .maybeSingle();
    if (checkError) throw checkError;
    if (existingStore) return storeError(400, 'El correo de contacto ya está registrado en otra tienda.');
  }

  for (const field of ['cover_image_url', 'logo_url'] as const) {
    if (body[field] && !isStoreImagePath(body[field], storeId)) {
      return storeError(400, 'La imagen no pertenece a esta tienda.');
    }
  }

  const { data: currentStore } = await supabase
    .from('stores')
    .select('cover_image_url, logo_url')
    .eq('id', storeId)
    .single();

  if (body.cover_image_url) {
    updateData.cover_image_url = body.cover_image_url as string;
    await processStoreImage(supabase, updateData.cover_image_url, 'cover', currentStore?.cover_image_url);
  }
  if (body.logo_url) {
    updateData.logo_url = body.logo_url as string;
    await processStoreImage(supabase, updateData.logo_url, 'logo', currentStore?.logo_url);
  }

  // Puede quedar vacío si el cuerpo solo traía campos reservados al admin, que
  // se descartan en silencio. Sin esto, el `.update({})` devuelve cero filas y el
  // `.single()` responde un error de PostgREST que no dice nada útil.
  //
  // Cambiar SOLO las categorías es un cambio válido aunque `updateData` esté
  // vacío: viven en otra tabla.
  if (Object.keys(updateData).length === 0 && categoryIds === null) {
    return storeError(400, 'No hay cambios que guardar, o los campos enviados no se pueden editar desde aquí.');
  }

  let data;
  if (Object.keys(updateData).length > 0) {
    const { data: updated, error } = await supabase.from('stores').update(updateData).eq('id', storeId).select().single();
    if (error) {
      console.error('stores PUT: update failed', error);
      return storeError(400, 'No se pudieron guardar los cambios.');
    }
    data = updated;
  } else {
    const { data: current } = await supabase.from('stores').select().eq('id', storeId).single();
    data = current;
  }

  if (categoryIds !== null) {
    try {
      await setStoreCategories(supabase, storeId, categoryIds);
    } catch (e) {
      return storeError(
        400,
        e instanceof CategoryLinksError ? e.message : 'No se pudieron actualizar las categorías de la tienda.'
      );
    }
  }

  return { status: 200, body: { data } };
}
