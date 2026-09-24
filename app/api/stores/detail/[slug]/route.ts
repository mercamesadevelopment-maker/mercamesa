import { NextResponse } from 'next/server';
import { createClient } from '../../../../../lib/supabase/server';
import { getSupabaseImageUrl, PRESET_COVER_DETAIL, PRESET_LOGO } from '../../../../../lib/supabase/supabase-image';

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
        marketplaces ( name ),
        store_category_links ( store_categories ( id, name ) )
      `)
      .eq('slug', slug)
      .single();

    if (storeError || !store) {
      return NextResponse.json({ error: storeError?.message || 'Store not found' }, { status: 404 });
    }

    // Usar transformaciones de Supabase (síncrono, cacheable)
    const coverSignedUrl = store.cover_image_url
      ? getSupabaseImageUrl('stores', store.cover_image_url, PRESET_COVER_DETAIL)
      : null;

    const logoSignedUrl = store.logo_url
      ? getSupabaseImageUrl('stores', store.logo_url, PRESET_LOGO)
      : null;

    // Se aplana el embed anidado (vínculo → categoría) a la lista de categorías,
    // igual que en `/api/stores/[id]`.
    const { store_category_links, ...rest } = store as typeof store & {
      store_category_links?: { store_categories: { id: string; name: string } | null }[] | null;
    };

    const categories = (store_category_links ?? [])
      .map((l) => l.store_categories)
      .filter((c): c is { id: string; name: string } => Boolean(c));

    return NextResponse.json({
      data: {
        ...rest,
        categories,
        coverSignedUrl,
        logoSignedUrl
      }
    }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

