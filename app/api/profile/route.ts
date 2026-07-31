import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { getSupabaseImageUrl, PRESET_LOGO } from '../../../lib/supabase/supabase-image';
import { uploadVariants, removeImageAndVariants } from '../../../lib/images/generate';
import { Database } from '../../../types/database_generated';

type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, phone, email, document_type, document_number, avatar_url')
      .eq('id', user.id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const avatarSignedUrl = data.avatar_url
      ? getSupabaseImageUrl('avatars', data.avatar_url, PRESET_LOGO)
      : null;

    return NextResponse.json({ data: { ...data, avatarSignedUrl } }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const updateData: Partial<ProfileUpdate> = {};

    const fields: (keyof ProfileUpdate)[] = ['full_name', 'phone', 'document_type', 'document_number'];
    fields.forEach((field) => {
      const val = body[field as string];
      if (val !== undefined) {
        (updateData as Record<string, unknown>)[field] = String(val);
      }
    });

    // El cliente ya subió el original directo a Storage (evita el límite de
    // payload de las funciones serverless); acá solo descargamos el buffer
    // para generar los derivados con sharp.
    if (body.avatar_url) {
      const path = body.avatar_url as string;

      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .single();

      const { data: fileData, error: downloadError } = await supabase.storage
        .from('avatars')
        .download(path);
      if (downloadError) throw downloadError;
      const buffer = Buffer.from(await fileData.arrayBuffer());

      updateData.avatar_url = path;
      await uploadVariants(supabase, 'avatars', path, buffer, ['logo']);

      if (currentProfile?.avatar_url) {
        await removeImageAndVariants(supabase, 'avatars', currentProfile.avatar_url, ['logo']);
      }
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id)
      .select('full_name, phone, email, document_type, document_number, avatar_url')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const avatarSignedUrl = data.avatar_url
      ? getSupabaseImageUrl('avatars', data.avatar_url, PRESET_LOGO)
      : null;

    return NextResponse.json({ data: { ...data, avatarSignedUrl } }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
