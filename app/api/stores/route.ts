import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { Database } from '../../../types/database_generated';
import { uploadVariants } from '../../../lib/images/generate';
import { getSupabaseImageUrl, PRESET_COVER_DETAIL, PRESET_LOGO } from '../../../lib/supabase/supabase-image';

type StoreInsert = Database['public']['Tables']['stores']['Insert'];

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const active = searchParams.get('is_active');
  const marketplaceId = searchParams.get('marketplace_id');
  const memberOnly = searchParams.get('member_only') === 'true';

  const { data: { user } } = await supabase.auth.getUser();

  let selectStr = `
    *,
    marketplaces ( name ),
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

  if (memberOnly && user) {
    selectStr = `
      *,
      marketplaces ( name ),
      store_members!inner (
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
  }

  let query = supabase.from('stores').select(selectStr);
  
  if (active !== null) query = query.eq('is_active', active === 'true');
  if (marketplaceId) query = query.eq('marketplace_id', marketplaceId);
  if (memberOnly && user) query = query.eq('store_members.user_id', user.id);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Fetch required document types
  const { data: requiredDocumentTypes, error: typesError } = await supabase
    .from('document_types')
    .select('id, name, slug, is_required')
    .eq('is_required', true);

  if (typesError) {
    return NextResponse.json({ error: typesError.message }, { status: 400 });
  }

  const dataWithUrls = data?.map((store: any) => ({
    ...store,
    logoSignedUrl: store.logo_url ? getSupabaseImageUrl('stores', store.logo_url, PRESET_LOGO) : null,
    coverSignedUrl: store.cover_image_url ? getSupabaseImageUrl('stores', store.cover_image_url, PRESET_COVER_DETAIL) : null,
  }));

  return NextResponse.json({ data: dataWithUrls, requiredDocumentTypes }, { status: 200 });
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const storeId = crypto.randomUUID();
    
    const name = formData.get('name') as string;
    const slug = formData.get('slug') as string;
    const marketplace_id = formData.get('marketplace_id') as string;
    const description = formData.get('description') as string | null;
    const contact_name = formData.get('contact_name') as string | null;
    const contact_email = formData.get('contact_email') as string | null;
    const phone = formData.get('phone') as string | null;
    const whatsapp = formData.get('whatsapp') as string | null;
    const is_active = formData.get('is_active') === 'true';

    if (!name || !slug || !marketplace_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (contact_email) {
      const { data: existingStore, error: checkError } = await supabase
        .from('stores')
        .select('id')
        .eq('contact_email', contact_email)
        .maybeSingle();

      if (checkError) throw checkError;
      if (existingStore) {
        return NextResponse.json({ error: 'El correo de contacto ya está registrado en otra tienda.' }, { status: 400 });
      }
    }

    let cover_image_url: string | null = null;
    let logo_url: string | null = null;

    const coverImage = formData.get('cover_image') as File | null;
    if (coverImage && coverImage.size > 0) {
      const path = `imgs/${storeId}/cover-${Date.now()}.${coverImage.name.split('.').pop()}`;
      const buffer = Buffer.from(await coverImage.arrayBuffer());
      const { error: uploadError } = await supabase.storage.from('stores').upload(path, buffer, {
        contentType: coverImage.type || undefined,
      });
      if (uploadError) throw uploadError;
      cover_image_url = path;
      await uploadVariants(supabase, 'stores', path, buffer, ['cover']);
    }

    const logoImage = formData.get('logo') as File | null;
    if (logoImage && logoImage.size > 0) {
      const path = `imgs/${storeId}/logo-${Date.now()}.${logoImage.name.split('.').pop()}`;
      const buffer = Buffer.from(await logoImage.arrayBuffer());
      const { error: uploadError } = await supabase.storage.from('stores').upload(path, buffer, {
        contentType: logoImage.type || undefined,
      });
      if (uploadError) throw uploadError;
      logo_url = path;
      await uploadVariants(supabase, 'stores', path, buffer, ['logo']);
    }

    const insertData: StoreInsert = {
      id: storeId,
      name,
      slug,
      marketplace_id,
      description,
      contact_name,
      contact_email,
      phone,
      whatsapp,
      is_active,
      is_verified: false,
      cover_image_url,
      logo_url,
    };

    const { data, error } = await supabase.from('stores').insert(insertData).select().single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Auto-assign or invite contact email as store_owner
    if (contact_email) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', contact_email)
        .maybeSingle();

      const storeOwnerRoleId = '5cd37ab3-c7e2-40a7-8677-363935b51e5a'; // store_owner

      if (profile) {
        // Create store_member row
        await supabase.from('store_members').insert({
          store_id: storeId,
          user_id: profile.id,
          role_id: storeOwnerRoleId,
          invited_by: user.id
        });

        // Trigger edge function
        try {
          const origin = request.headers.get('origin') || '';
          const edgeUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/notify-store-assignment`;
          await fetch(edgeUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
              email: contact_email,
              fullName: contact_name || 'Miembro',
              storeName: name,
              roleLabel: 'Dueño de Tienda',
              loginUrl: `${origin}/seller/onboarding`
            })
          });
        } catch (efErr) {
          console.error('Error invoking notify-store-assignment edge function:', efErr);
        }
      } else {
        // Invite new user and record invitation
        try {
          // We need a service role client to run inviteUserByEmail. We will import/create it here.
          const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
          const serviceSupabase = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );

          const origin = request.headers.get('origin') || '';
          const { error: inviteError } = await serviceSupabase.auth.admin.inviteUserByEmail(contact_email, {
            redirectTo: `${origin}/accept-invite`
          });

          if (!inviteError) {
            // Record in invitations
            const expires = new Date();
            expires.setDate(expires.getDate() + 7);

            await supabase.from('invitations').insert({
              email: contact_email,
              store_id: storeId,
              role: storeOwnerRoleId,
              invitation_type: 'store_member',
              invited_by: user.id,
              token: crypto.randomUUID(),
              expires_at: expires.toISOString()
            });
          }
        } catch (inviteErr) {
          console.error('Error inviting user:', inviteErr);
        }
      }
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
