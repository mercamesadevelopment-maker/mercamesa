import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { Database } from '../../../../types/database_generated';
import { getSupabaseImageUrl, PRESET_COVER_DETAIL, PRESET_LOGO } from '../../../../lib/supabase/supabase-image';
import { uploadVariants, removeImageAndVariants } from '../../../../lib/images/generate';

type StoreUpdate = Database['public']['Tables']['stores']['Update'];

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

    const formData = await request.formData();
    const updateData: Partial<StoreUpdate> = {};

    const fields: (keyof StoreUpdate)[] = [
      'name',
      'slug',
      'marketplace_id',
      'description',
      'contact_name',
      'contact_email',
      'phone',
      'whatsapp',
    ];

    fields.forEach((field) => {
      const val = formData.get(field as string);

      if (val !== null) {
        (updateData as Record<string, unknown>)[field] = String(val);
      }
    });

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

    const coverImage = formData.get('cover_image') as File | null;
    if (coverImage && coverImage.size > 0) {
      const path = `imgs/${id}/cover-${Date.now()}.${coverImage.name.split('.').pop()}`;
      const buffer = Buffer.from(await coverImage.arrayBuffer());
      const { error: uploadError } = await supabase.storage.from('stores').upload(path, buffer, {
        contentType: coverImage.type || undefined,
      });
      if (uploadError) throw uploadError;
      updateData.cover_image_url = path;
      await uploadVariants(supabase, 'stores', path, buffer, ['cover']);

      if (currentStore?.cover_image_url) {
        await removeImageAndVariants(supabase, 'stores', currentStore.cover_image_url, ['cover']);
      }
    }

    const logoImage = formData.get('logo') as File | null;
    if (logoImage && logoImage.size > 0) {
      const path = `imgs/${id}/logo-${Date.now()}.${logoImage.name.split('.').pop()}`;
      const buffer = Buffer.from(await logoImage.arrayBuffer());
      const { error: uploadError } = await supabase.storage.from('stores').upload(path, buffer, {
        contentType: logoImage.type || undefined,
      });
      if (uploadError) throw uploadError;
      updateData.logo_url = path;
      await uploadVariants(supabase, 'stores', path, buffer, ['logo']);

      if (currentStore?.logo_url) {
        await removeImageAndVariants(supabase, 'stores', currentStore.logo_url, ['logo']);
      }
    }

    const { data, error } = await supabase.from('stores').update(updateData).eq('id', id).select().single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
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
