import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { Database } from '../../../../types/database_generated';
import { getSupabaseImageUrl, PRESET_COVER_DETAIL, PRESET_LOGO } from '../../../../lib/supabase/supabase-image';
import { uploadVariants, removeImageAndVariants } from '../../../../lib/images/generate';
import { canManageStore } from '@/lib/auth/can-manage-store';

type StoreUpdate = Database['public']['Tables']['stores']['Update'];

/**
 * Campos que el tendero puede editar de su propia tienda: los descriptivos.
 * `local_address` es la ubicación dentro de la plaza, no una dirección postal.
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
 * Campos reservados a la plataforma. El `slug` es la URL pública, `marketplace_id`
 * mueve la tienda de plaza (y con ello cambia el punto de recogida de los
 * envíos), y verificación y grupo son decisiones de MercaMesa. Un tendero no
 * puede tocarlos ni mandándolos a mano.
 */
const ADMIN_ONLY_FIELDS = ['slug', 'marketplace_id', 'is_verified', 'store_group_id'] as const;

async function isPlatformAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('roles ( name )')
    .eq('id', userId)
    .single();
  const roleName = (profile as any)?.roles?.name;
  return roleName === 'admin' || roleName === 'superadmin';
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('stores')
    .select(`
      *,
      marketplaces ( name ),
      store_categories ( name ),
      store_members (
        id,
        role_id,
        roles ( name, label ),
        profiles!user_id ( id, full_name, email )
      )
    `)
    .eq('id', id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  // Usar transformaciones de Supabase (síncrono, cacheable)
  const coverSignedUrl = data.cover_image_url
    ? getSupabaseImageUrl('stores', data.cover_image_url, PRESET_COVER_DETAIL)
    : null;

  const logoSignedUrl = data.logo_url
    ? getSupabaseImageUrl('stores', data.logo_url, PRESET_LOGO)
    : null;

  return NextResponse.json({ data: { ...data, coverSignedUrl, logoSignedUrl } }, { status: 200 });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Antes esta ruta solo comprobaba que hubiera sesión, y `stores` no tiene
    // RLS: cualquier usuario autenticado podía renombrar, mover de plaza o
    // reemplazar el logo de CUALQUIER tienda.
    if (!(await canManageStore(supabase, id, user.id))) {
      return NextResponse.json({ error: 'No tienes permisos sobre esta tienda.' }, { status: 403 });
    }

    const isAdmin = await isPlatformAdmin(supabase, user.id);

    const body = await request.json();
    const updateData: Partial<StoreUpdate> = {};

    MEMBER_EDITABLE_FIELDS.forEach((field) => {
      const val = body[field];
      // `String(val)` convertía un null explícito en la cadena "null"; vaciar un
      // campo opcional debe guardarlo como null.
      if (val === undefined) return;
      (updateData as Record<string, unknown>)[field] =
        val === null || val === '' ? null : String(val);
    });

    // `name` es obligatorio en la tabla: no se puede vaciar.
    if (updateData.name === null) {
      return NextResponse.json({ error: 'El nombre de la tienda es obligatorio.' }, { status: 400 });
    }

    if (isAdmin) {
      ADMIN_ONLY_FIELDS.forEach((field) => {
        const val = body[field];
        if (val === undefined) return;
        (updateData as Record<string, unknown>)[field] =
          field === 'is_verified' ? Boolean(val) : val || null;
      });

      // `is_active` no estaba en la lista de campos, así que el modal del admin
      // lo enviaba y la ruta lo descartaba en silencio: activar o desactivar una
      // tienda desde ahí no hacía nada.
      if (body.is_active !== undefined) {
        updateData.is_active = Boolean(body.is_active);
      }
    }

    if (body.category_id !== undefined) {
      updateData.category_id = (body.category_id as string) || null;
    }

    if (body.business_hours !== undefined) {
      updateData.business_hours = body.business_hours || null;
    }

    if (updateData.contact_email) {
      const { data: existingStore, error: checkError } = await supabase
        .from('stores')
        .select('id')
        .eq('contact_email', updateData.contact_email)
        .neq('id', id)
        .maybeSingle();

      if (checkError) throw checkError;
      if (existingStore) {
        return NextResponse.json({ error: 'El correo de contacto ya está registrado en otra tienda.' }, { status: 400 });
      }
    }

    const { data: currentStore } = await supabase
      .from('stores')
      .select('cover_image_url, logo_url')
      .eq('id', id)
      .single();

    // El cliente ya subió el/los original(es) directo a Storage (evita el
    // límite de payload de las funciones serverless); acá solo descargamos
    // el buffer para generar los derivados con sharp.
    if (body.cover_image_url) {
      const path = body.cover_image_url as string;
      const { data: fileData, error: downloadError } = await supabase.storage.from('stores').download(path);
      if (downloadError) throw downloadError;
      const buffer = Buffer.from(await fileData.arrayBuffer());

      updateData.cover_image_url = path;
      await uploadVariants(supabase, 'stores', path, buffer, ['cover']);

      if (currentStore?.cover_image_url) {
        await removeImageAndVariants(supabase, 'stores', currentStore.cover_image_url, ['cover']);
      }
    }

    if (body.logo_url) {
      const path = body.logo_url as string;
      const { data: fileData, error: downloadError } = await supabase.storage.from('stores').download(path);
      if (downloadError) throw downloadError;
      const buffer = Buffer.from(await fileData.arrayBuffer());

      updateData.logo_url = path;
      await uploadVariants(supabase, 'stores', path, buffer, ['logo']);

      if (currentStore?.logo_url) {
        await removeImageAndVariants(supabase, 'stores', currentStore.logo_url, ['logo']);
      }
    }

    // Puede quedar vacío si el cuerpo solo traía campos reservados al admin, que
    // se descartan en silencio. Sin esto, el `.update({})` devuelve cero filas y
    // el `.single()` responde un error de PostgREST que no dice nada útil.
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No hay cambios que guardar, o los campos enviados no se pueden editar desde aquí.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.from('stores').update(updateData).eq('id', id).select().single();

    if (error) {
      console.error('stores PUT: update failed', error);
      return NextResponse.json({ error: 'No se pudieron guardar los cambios.' }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Borrar una tienda arrastra sus productos, pedidos y miembros. No es una
    // acción de tendero: se reserva a la plataforma.
    if (!(await isPlatformAdmin(supabase, user.id))) {
      return NextResponse.json(
        { error: 'Solo el equipo de MercaMesa puede eliminar una tienda.' },
        { status: 403 }
      );
    }

    const { data: storeToDelete } = await supabase.from('stores').select('cover_image_url, logo_url').eq('id', id).single();

    if (storeToDelete?.cover_image_url) {
      await removeImageAndVariants(supabase, 'stores', storeToDelete.cover_image_url, ['cover']);
    }
    if (storeToDelete?.logo_url) {
      await removeImageAndVariants(supabase, 'stores', storeToDelete.logo_url, ['logo']);
    }

    const { error } = await supabase.from('stores').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Deleted successfully' }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
