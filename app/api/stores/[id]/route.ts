import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { Database } from '../../../../types/database_generated';

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

  let coverSignedUrl = null;
  let logoSignedUrl = null;

  if (data.cover_image_url) {
    const { data: signedData } = await supabase.storage.from('stores').createSignedUrl(data.cover_image_url, 3600);
    coverSignedUrl = signedData?.signedUrl;
  }

  if (data.logo_url) {
    const { data: signedData } = await supabase.storage.from('stores').createSignedUrl(data.logo_url, 3600);
    logoSignedUrl = signedData?.signedUrl;
  }

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

    const coverImage = formData.get('cover_image') as File | null;
    if (coverImage && coverImage.size > 0) {
      const path = `imgs/${id}/cover-${Date.now()}.${coverImage.name.split('.').pop()}`;
      const { error: uploadError } = await supabase.storage.from('stores').upload(path, coverImage);
      if (uploadError) throw uploadError;
      updateData.cover_image_url = path;
    }

    const logoImage = formData.get('logo') as File | null;
    if (logoImage && logoImage.size > 0) {
      const path = `imgs/${id}/logo-${Date.now()}.${logoImage.name.split('.').pop()}`;
      const { error: uploadError } = await supabase.storage.from('stores').upload(path, logoImage);
      if (uploadError) throw uploadError;
      updateData.logo_url = path;
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

    const { data: currentStore } = await supabase.from('stores').select('cover_image_url, logo_url').eq('id', id).single();

    if (currentStore) {
      const filesToDelete = [];
      if (currentStore.cover_image_url) filesToDelete.push(currentStore.cover_image_url);
      if (currentStore.logo_url) filesToDelete.push(currentStore.logo_url);
      if (filesToDelete.length > 0) {
        await supabase.storage.from('stores').remove(filesToDelete);
      }
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
