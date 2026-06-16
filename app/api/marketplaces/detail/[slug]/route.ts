import { NextResponse } from 'next/server';
import { getMarketplaceDetail } from '@/app/services/marketplaces/marketplaces.service';
import { createClient } from '@/lib/supabase/server';

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
      ? supabase.storage
          .from('plazas')
          .getPublicUrl(data.cover_image_url).data.publicUrl
      : null;

    const logoUrl = data.logo_url
      ? supabase.storage
          .from('plazas')
          .getPublicUrl(data.logo_url).data.publicUrl
      : null;

    const stores = Array.isArray(data.stores)
      ? data.stores
      : [];

    const storesWithPublicUrls = stores.map((store: Store) => {
      const logoUrl = store.logo_url
        ? supabase.storage
            .from('stores')
            .getPublicUrl(store.logo_url).data.publicUrl
        : null;
      return {
        ...store,
        logoUrl,
        logoSignedUrl: logoUrl,
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