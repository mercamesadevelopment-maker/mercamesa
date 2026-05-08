import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { Database } from '../../../types/database_generated';

type StoreInsert = Database['public']['Tables']['stores']['Insert'];

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const active = searchParams.get('is_active');
  const marketplaceId = searchParams.get('marketplace_id');

  let query = supabase.from('stores').select(`
    *,
    marketplaces ( name ),
    profiles ( full_name )
  `);
  
  if (active !== null) query = query.eq('is_active', active === 'true');
  if (marketplaceId) query = query.eq('marketplace_id', marketplaceId);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data }, { status: 200 });
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

    let cover_image_url: string | null = null;
    let logo_url: string | null = null;

    const coverImage = formData.get('cover_image') as File | null;
    if (coverImage && coverImage.size > 0) {
      const path = `imgs/${storeId}/cover-${Date.now()}.${coverImage.name.split('.').pop()}`;
      const { error: uploadError } = await supabase.storage.from('stores').upload(path, coverImage);
      if (uploadError) throw uploadError;
      cover_image_url = path;
    }

    const logoImage = formData.get('logo') as File | null;
    if (logoImage && logoImage.size > 0) {
      const path = `imgs/${storeId}/logo-${Date.now()}.${logoImage.name.split('.').pop()}`;
      const { error: uploadError } = await supabase.storage.from('stores').upload(path, logoImage);
      if (uploadError) throw uploadError;
      logo_url = path;
    }

    const insertData: StoreInsert = {
      id: storeId,
      name,
      slug,
      marketplace_id,
      owner_id: user.id, // For demo purposes, we assign the creator as owner. 
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

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
