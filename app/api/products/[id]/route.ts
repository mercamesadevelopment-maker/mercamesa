import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { Database } from '../../../../types/database_generated';

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

  let imageSignedUrl = null;

  if (data.image_url) {
    const { data: signedData } = await supabase.storage.from('products').createSignedUrl(data.image_url, 3600);
    imageSignedUrl = signedData?.signedUrl;
  }

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
      const path = `imgs/${id}/img-${Date.now()}.${image.name.split('.').pop()}`;
      const { error: uploadError } = await supabase.storage.from('products').upload(path, image);
      if (uploadError) throw uploadError;
      updateData.image_url = path;
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

    if (currentProduct?.image_url) {
      await supabase.storage.from('products').remove([currentProduct.image_url]);
    }

    const { error } = await supabase.from('catalog_products').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Deleted successfully' }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
