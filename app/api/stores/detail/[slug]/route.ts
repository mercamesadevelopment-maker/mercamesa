import { NextResponse } from 'next/server';
import { createClient } from '../../../../../lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const supabase = await createClient();

    // Fetch store details with marketplace info
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select(`
        *,
        marketplaces ( name )
      `)
      .eq('slug', slug)
      .single();

    if (storeError || !store) {
      return NextResponse.json({ error: storeError?.message || 'Store not found' }, { status: 404 });
    }

    // Get signed URLs for the store
    let coverSignedUrl = null;
    let logoSignedUrl = null;

    if (store.cover_image_url) {
      const { data: signedData } = await supabase.storage.from('stores').createSignedUrl(store.cover_image_url, 3600);
      coverSignedUrl = signedData?.signedUrl;
    }

    if (store.logo_url) {
      const { data: signedData } = await supabase.storage.from('stores').createSignedUrl(store.logo_url, 3600);
      logoSignedUrl = signedData?.signedUrl;
    }

    return NextResponse.json({ 
      data: { 
        ...store, 
        coverSignedUrl, 
        logoSignedUrl
      } 
    }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
