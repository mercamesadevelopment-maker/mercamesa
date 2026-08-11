import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { Database } from '../../../../types/database_generated';
import {
  PRODUCT_CODE_UNIQUE_INDEX,
  duplicateProductCodeMessage,
  normalizeProductCode,
  validateProductCode,
} from '@/lib/products/product-code';

type StoreProductUpdate = Database['public']['Tables']['store_products']['Update'];

const MAX_FEATURED_PER_STORE = 5;
const MAX_FEATURED_MESSAGE = `Ya tienes ${MAX_FEATURED_PER_STORE} productos destacados. Quita uno para destacar otro.`;

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

    const body = await request.json();

    const updateData: StoreProductUpdate = {};

    if (body.price_per_unit !== undefined) updateData.price_per_unit = Number(body.price_per_unit);
    if (body.stock !== undefined) updateData.stock = Number(body.stock);
    if (body.min_order_qty !== undefined) updateData.min_order_qty = Number(body.min_order_qty);
    if (body.wholesale_price !== undefined) updateData.wholesale_price = body.wholesale_price ? Number(body.wholesale_price) : null;
    if (body.wholesale_min_qty !== undefined) updateData.wholesale_min_qty = body.wholesale_min_qty ? Number(body.wholesale_min_qty) : null;
    if (body.is_active !== undefined) updateData.is_active = Boolean(body.is_active);
    if (body.unit_id !== undefined) updateData.unit_id = body.unit_id;
    if (body.store_id !== undefined) updateData.store_id = body.store_id;
    if (body.catalog_product_id !== undefined) updateData.catalog_product_id = body.catalog_product_id;

    // El código es obligatorio también al editar: es la vía por la que los
    // productos publicados antes de existir la columna van quedando completos.
    if (body.code !== undefined) {
      const codeError = validateProductCode(body.code);
      if (codeError) {
        return NextResponse.json({ error: codeError }, { status: 400 });
      }
      updateData.code = normalizeProductCode(body.code);
    }

    if (body.is_featured !== undefined) {
      const wantsFeatured = Boolean(body.is_featured);

      const { data: current, error: currentError } = await supabase
        .from('store_products')
        .select('store_id, is_featured')
        .eq('id', id)
        .single();

      if (currentError) {
        return NextResponse.json({ error: currentError.message }, { status: 400 });
      }

      if (wantsFeatured && !current.is_featured) {
        const { count, error: countError } = await supabase
          .from('store_products')
          .select('id', { count: 'exact', head: true })
          .eq('store_id', current.store_id)
          .eq('is_featured', true);

        if (countError) {
          return NextResponse.json({ error: countError.message }, { status: 400 });
        }

        if ((count ?? 0) >= MAX_FEATURED_PER_STORE) {
          return NextResponse.json({ error: MAX_FEATURED_MESSAGE }, { status: 400 });
        }
      }

      updateData.is_featured = wantsFeatured;
      updateData.featured_at = wantsFeatured ? new Date().toISOString() : null;
    }

    updateData.last_price_update = new Date().toISOString();

    const { data, error } = await supabase.from('store_products').update(updateData).eq('id', id).select().single();

    if (error) {
      if (error.code === '23505' && error.message.includes(PRODUCT_CODE_UNIQUE_INDEX)) {
        return NextResponse.json({ error: duplicateProductCodeMessage(body.code) }, { status: 409 });
      }
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

    const { error } = await supabase.from('store_products').delete().eq('id', id);

    if (error) {
      if (error.code === '23503') {
        const message = [
          'Este producto no puede eliminarse del inventario de la tienda porque ya tiene actividad asociada',
          '(pedidos, carritos o movimientos de stock registrados).',
          '',
          'En vez de eliminarlo, desactívalo para que deje de mostrarse en la tienda sin perder ese historial.',
        ].join('\n');

        return NextResponse.json({ error: message }, { status: 409 });
      }

      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Deleted successfully' }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
