import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { Database } from '../../../types/database_generated';
import { getSupabaseImageUrl, PRESET_PRODUCT_CARD } from '../../../lib/supabase/supabase-image';
import {
  PRODUCT_CODE_UNIQUE_INDEX,
  duplicateProductCodeMessage,
  normalizeProductCode,
  validateProductCode,
} from '@/lib/products/product-code';

type StoreProductInsert = Database['public']['Tables']['store_products']['Insert'];

const MAX_FEATURED_PER_STORE = 5;
const MAX_FEATURED_MESSAGE = `Ya tienes ${MAX_FEATURED_PER_STORE} productos destacados. Quita uno para destacar otro.`;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get('store_id');

  let query = supabase.from('store_products').select(`
    *,
    catalog_products ( name, image_url, description, category_id, categories ( id, name, parent_id ) ),
    stores ( name, marketplaces ( name ) ),
    measurement_units ( abbreviation )
  `);

  if (storeId) {
    query = query.eq('store_id', storeId);
  }

  query = query
    .order('is_featured', { ascending: false })
    .order('featured_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // categories se auto-referencia vía parent_id; PostgREST no resuelve un
  // embed de "categories" dentro de sí misma en este anidamiento, así que
  // el nombre del padre se resuelve acá con un mapa simple en vez de un
  // segundo nivel de embed.
  const parentIds = Array.from(
    new Set(
      data
        .map((p) => p.catalog_products?.categories?.parent_id)
        .filter((id): id is string => !!id)
    )
  );

  let parentNameById = new Map<string, string>();
  if (parentIds.length > 0) {
    const { data: parents } = await supabase
      .from('categories')
      .select('id, name')
      .in('id', parentIds);
    parentNameById = new Map((parents || []).map((c) => [c.id, c.name]));
  }

  // Generar URLs con transformación de Supabase (síncrono, cacheable)
  const productsWithSignedUrls = data.map((product) => {
    const imageSignedUrl = product.catalog_products?.image_url
      ? getSupabaseImageUrl('products', product.catalog_products.image_url, PRESET_PRODUCT_CARD)
      : null;
    const category = product.catalog_products?.categories;
    const categoryWithParent = category
      ? { ...category, parent: category.parent_id ? { name: parentNameById.get(category.parent_id) || '' } : null }
      : category;
    return {
      ...product,
      imageSignedUrl,
      catalog_products: product.catalog_products
        ? { ...product.catalog_products, categories: categoryWithParent }
        : product.catalog_products,
    };
  });

  return NextResponse.json({ data: productsWithSignedUrls }, { status: 200 });
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    // Asignación masiva del admin (Catálogo -> "Asignar Producto a Tienda"):
    // un producto del catálogo a varias tiendas de una. Acá no se exige `code`
    // a propósito, porque el admin no puede conocer el código interno de cada
    // tienda; esos productos quedan sin código y el vendedor lo completa al
    // editarlos, igual que los publicados antes de existir la columna.
    if (Array.isArray(body)) {
      const inserts = body.map((item: any) => ({
        catalog_product_id: item.catalog_product_id,
        store_id: item.store_id,
        unit_id: item.unit_id,
        price_per_unit: Number(item.price_per_unit || 0),
        stock: Number(item.stock || 0),
        min_order_qty: Number(item.min_order_qty || 1),
        wholesale_price: item.wholesale_price ? Number(item.wholesale_price) : null,
        wholesale_min_qty: item.wholesale_min_qty ? Number(item.wholesale_min_qty) : null,
        is_active: item.is_active ?? true,
      }));

      const { data, error } = await supabase.from('store_products').insert(inserts).select();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ data }, { status: 201 });
    }
    
    const codeError = validateProductCode(body.code);
    if (codeError) {
      return NextResponse.json({ error: codeError }, { status: 400 });
    }

    const isFeatured = body.is_featured === true;

    if (isFeatured) {
      const { count, error: countError } = await supabase
        .from('store_products')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', body.store_id)
        .eq('is_featured', true);

      if (countError) {
        return NextResponse.json({ error: countError.message }, { status: 400 });
      }

      if ((count ?? 0) >= MAX_FEATURED_PER_STORE) {
        return NextResponse.json({ error: MAX_FEATURED_MESSAGE }, { status: 400 });
      }
    }

    const insertData: StoreProductInsert = {
      catalog_product_id: body.catalog_product_id,
      store_id: body.store_id,
      unit_id: body.unit_id,
      price_per_unit: Number(body.price_per_unit),
      stock: Number(body.stock || 0),
      min_order_qty: Number(body.min_order_qty || 1),
      wholesale_price: body.wholesale_price ? Number(body.wholesale_price) : null,
      wholesale_min_qty: body.wholesale_min_qty ? Number(body.wholesale_min_qty) : null,
      is_active: body.is_active ?? true,
      is_featured: isFeatured,
      featured_at: isFeatured ? new Date().toISOString() : null,
      code: normalizeProductCode(body.code),
    };

    const { data, error } = await supabase.from('store_products').insert(insertData).select().single();

    if (error) {
      if (error.code === '23505' && error.message.includes(PRODUCT_CODE_UNIQUE_INDEX)) {
        return NextResponse.json({ error: duplicateProductCodeMessage(body.code) }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
