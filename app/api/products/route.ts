import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { Database } from '../../../types/database_generated';
import { getSupabaseImageUrl, PRESET_THUMBNAIL } from '../../../lib/supabase/supabase-image';

type ProductInsert = Database['public']['Tables']['catalog_products']['Insert'];

export async function GET() {
  const supabase = await createClient();
  
  // Intentamos traer también la categoría y la unidad si las relaciones están configuradas
  const { data, error } = await supabase.from('catalog_products').select(`
    *,
    categories ( name ),
    measurement_units ( abbreviation )
  `);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Generar URLs con transformación de Supabase (cacheable, sin llamadas de red adicionales)
  const productsWithPublicUrls = (data || []).map((product) => {
    const imageSignedUrl = product.image_url
      ? getSupabaseImageUrl('products', product.image_url, PRESET_THUMBNAIL)
      : null;
    return { ...product, imageSignedUrl };
  });

  return NextResponse.json({ data: productsWithPublicUrls }, { status: 200 });
}


export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const productId = crypto.randomUUID();
    
    const name = formData.get('name') as string;
    const slug = formData.get('slug') as string;
    const category_id = formData.get('category_id') as string | null;
    const default_unit_id = formData.get('default_unit_id') as string | null;
    const description = formData.get('description') as string | null;
    const dane_unit_code = formData.get('dane_unit_code') as string | null;
    const dane_unit_name = formData.get('dane_unit_name') as string | null;
    
    const is_active = formData.get('is_active') === 'true';
    const is_ancestral_food = formData.get('is_ancestral_food') === 'true';
    const is_medicinal_plant = formData.get('is_medicinal_plant') === 'true';
    const is_non_food = formData.get('is_non_food') === 'true';

    if (!name || !slug) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let image_url: string | null = null;

    const image = formData.get('image') as File | null;
    if (image && image.size > 0) {
      const path = `imgs/${productId}/img-${Date.now()}.${image.name.split('.').pop()}`;
      const { error: uploadError } = await supabase.storage.from('products').upload(path, image);
      if (uploadError) throw uploadError;
      image_url = path;
    }

    const insertData: ProductInsert = {
      id: productId,
      name,
      slug,
      category_id: category_id || null,
      default_unit_id: default_unit_id || null,
      description,
      is_active,
      is_ancestral_food,
      is_medicinal_plant,
      is_non_food,
      image_url,
      dane_unit_code: dane_unit_code || null,
      dane_unit_name: dane_unit_name || null,
      created_by: user.id
    };

    const { data, error } = await supabase.from('catalog_products').insert(insertData).select().single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
