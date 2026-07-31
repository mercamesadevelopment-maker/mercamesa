import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { Database } from '../../../../types/database_generated';
import { getSupabaseImageUrl, PRESET_PRODUCT_CARD } from '../../../../lib/supabase/supabase-image';
import { uploadVariants, removeImageAndVariants } from '../../../../lib/images/generate';
import { PRODUCT_IMAGE_VARIANTS } from '../../../../lib/images/variants';

type ProductUpdate = Database['public']['Tables']['catalog_products']['Update'];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('catalog_products')
    .select('*, categories(name), measurement_units(abbreviation)')
    .eq('id', id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  // Usar transformación de Supabase (cacheable, síncrono sin red)
  const imageSignedUrl = data.image_url
    ? getSupabaseImageUrl('products', data.image_url, PRESET_PRODUCT_CARD)
    : null;

  return NextResponse.json({ data: { ...data, imageSignedUrl } }, { status: 200 });
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
    const updateData: Partial<ProductUpdate> = {};

    const fields: (keyof ProductUpdate)[] = [
      'name',
      'slug',
      'category_id',
      'default_unit_id',
      'description',
      'dane_unit_code',
      'dane_unit_name',
    ];

    fields.forEach((field) => {
      const val = formData.get(field as string);

      if (val !== null) {
        (updateData as Record<string, unknown>)[field] = val === '' ? null : String(val);
      }
    });

    const booleanFields: (keyof ProductUpdate)[] = [
      'is_active',
      'is_ancestral_food',
      'is_medicinal_plant',
      'is_non_food',
    ];

    booleanFields.forEach((field) => {
      if (formData.has(field as string)) {
        (updateData as Record<string, unknown>)[field] =
          formData.get(field as string) === 'true';
      }
    });

    const image = formData.get('image') as File | null;
    if (image && image.size > 0) {
      const { data: currentProduct } = await supabase
        .from('catalog_products')
        .select('image_url')
        .eq('id', id)
        .single();

      const path = `imgs/${id}/img-${Date.now()}.${image.name.split('.').pop()}`;
      const buffer = Buffer.from(await image.arrayBuffer());
      const { error: uploadError } = await supabase.storage.from('products').upload(path, buffer, {
        contentType: image.type || undefined,
      });
      if (uploadError) throw uploadError;
      updateData.image_url = path;
      await uploadVariants(supabase, 'products', path, buffer, PRODUCT_IMAGE_VARIANTS);

      if (currentProduct?.image_url) {
        await removeImageAndVariants(supabase, 'products', currentProduct.image_url, PRODUCT_IMAGE_VARIANTS);
      }
    }

    const { data, error } = await supabase.from('catalog_products').update(updateData).eq('id', id).select().single();

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

    const { data: currentProduct } = await supabase.from('catalog_products').select('image_url').eq('id', id).single();

    const { error } = await supabase.from('catalog_products').delete().eq('id', id);

    if (error) {
      if (error.code === '23503') {
        const { data: usages } = await supabase
          .from('store_products')
          .select('stores(name)')
          .eq('catalog_product_id', id);

        const storeNames = Array.from(
          new Set(
            (usages || [])
              .map((u: { stores: { name: string } | { name: string }[] | null }) =>
                Array.isArray(u.stores) ? u.stores[0]?.name : u.stores?.name
              )
              .filter((name): name is string => Boolean(name))
          )
        );

        const message = [
          'Este producto no puede eliminarse porque aún está siendo utilizado en algunas tiendas.',
          '',
          'Primero elimina el producto de los inventarios de las siguientes tiendas:',
          ...storeNames.map((name) => `- ${name}`),
          '',
          'Después podrás eliminarlo del catálogo.',
        ].join('\n');

        return NextResponse.json({ error: message, stores: storeNames }, { status: 409 });
      }

      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (currentProduct?.image_url) {
      await removeImageAndVariants(supabase, 'products', currentProduct.image_url, PRODUCT_IMAGE_VARIANTS);
    }

    return NextResponse.json({ message: 'Deleted successfully' }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
