import { NextResponse } from 'next/server';
import { getMarketplaceDetail } from '@/app/services/marketplaces/marketplaces.service';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseImageUrl, PRESET_COVER_DETAIL, PRESET_LOGO } from '@/lib/supabase/supabase-image';

type Store = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const supabase = await createClient();

    const data = await getMarketplaceDetail(
      supabase,
      slug
    );

    if (!data) {
      return NextResponse.json(
        { error: 'Marketplace not found' },
        { status: 404 }
      );
    }

    const coverImageUrl = data.cover_image_url
      ? getSupabaseImageUrl('plazas', data.cover_image_url, PRESET_COVER_DETAIL)
      : null;

    const logoUrl = data.logo_url
      ? getSupabaseImageUrl('plazas', data.logo_url, PRESET_LOGO)
      : null;

    const stores = Array.isArray(data.stores)
      ? data.stores
      : [];

    const storesWithPublicUrls = stores.map((store: Store) => {
      const storeLogo = store.logo_url
        ? getSupabaseImageUrl('stores', store.logo_url, PRESET_LOGO)
        : null;
      return {
        ...store,
        logoUrl: storeLogo,
        logoSignedUrl: storeLogo,
      };
    });

    return NextResponse.json(
      {
        data: {
          ...data,
          coverImageUrl,
          logoUrl,
          coverSignedUrl: coverImageUrl,
          logoSignedUrl: logoUrl,
          stores: storesWithPublicUrls,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error(error);

    const message =
      error instanceof Error
        ? error.message
        : 'Internal Server Error';

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}