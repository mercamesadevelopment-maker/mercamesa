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

    const formData = await request.formData();
    const updateData: Partial<ProfileUpdate> = {};

    const fields: (keyof ProfileUpdate)[] = ['full_name', 'phone', 'document_type', 'document_number'];
    fields.forEach((field) => {
      const val = formData.get(field as string);
      if (val !== null) {
        (updateData as Record<string, unknown>)[field] = String(val);
      }
    });

    const avatar = formData.get('avatar') as File | null;
    if (avatar && avatar.size > 0) {
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .single();

      const path = `${user.id}/avatar-${Date.now()}.${avatar.name.split('.').pop()}`;
      const buffer = Buffer.from(await avatar.arrayBuffer());
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, buffer, {
        contentType: avatar.type || undefined,
      });
      if (uploadError) throw uploadError;

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
