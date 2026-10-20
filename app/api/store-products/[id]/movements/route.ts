import { NextResponse } from 'next/server';
import { createClient } from '../../../../../lib/supabase/server';
import { canManageStore } from '@/lib/auth/can-manage-store';

/** La tienda del producto, para comprobar que quien pregunta la gestiona. */
async function storeOfProduct(supabase: Awaited<ReturnType<typeof createClient>>, productId: string) {
  const { data } = await supabase.from('store_products').select('store_id').eq('id', productId).maybeSingle();
  return data?.store_id as string | undefined;
}

export async function GET(
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

    // El inventario de una tienda es de su gente (o de un admin).
    const storeId = await storeOfProduct(supabase, id);
    if (!storeId || !(await canManageStore(supabase, storeId, user.id))) {
      return NextResponse.json({ error: 'No tienes permisos sobre este producto.' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('product_stock_movements')
      .select(`
        id,
        store_product_id,
        store_id,
        type,
        quantity,
        reference_id,
        reference_type,
        notes,
        created_at,
        registered_by,
        profiles!registered_by (
          full_name,
          email
        )
      `)
      .eq('store_product_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
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

    const { type, quantity, notes } = await request.json();

    if (!type || quantity === undefined || quantity < 0) {
      return NextResponse.json({ error: 'Tipo y cantidad válida son requeridos.' }, { status: 400 });
    }

    // Fetch the existing product to check old stock
    const { data: existingProduct, error: fetchError } = await supabase
      .from('store_products')
      .select('stock, store_id')
      .eq('id', id)
      .single();

    if (fetchError || !existingProduct) {
      return NextResponse.json({ error: fetchError?.message || 'Product not found' }, { status: 404 });
    }

    // Antes bastaba con tener sesión para registrar movimientos en cualquier tienda.
    if (!(await canManageStore(supabase, existingProduct.store_id, user.id))) {
      return NextResponse.json({ error: 'No tienes permisos sobre este producto.' }, { status: 403 });
    }

    const oldStock = Number(existingProduct.stock || 0);
    let newStock = oldStock;
    let movementQty = Number(quantity);

    if (type === 'entry') {
      newStock = oldStock + movementQty;
    } else if (type === 'exit') {
      newStock = oldStock - movementQty;
    } else if (type === 'adjustment') {
      newStock = movementQty;
      movementQty = Math.abs(newStock - oldStock);
    }

    // Update store product stock
    const { error: updateError } = await supabase
      .from('store_products')
      .update({ stock: newStock })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    // Insert stock movement record
    const { error: movementError } = await supabase
      .from('product_stock_movements')
      .insert({
        store_product_id: id,
        store_id: existingProduct.store_id,
        type: type,
        quantity: movementQty,
        reference_type: 'adjustment_manual',
        notes: notes || `Movimiento manual: ${type === 'entry' ? 'Entrada' : type === 'exit' ? 'Salida' : 'Ajuste'}`,
        registered_by: user.id
      });

    if (movementError) {
      console.error('Failed to log stock movement:', movementError.message);
    }

    return NextResponse.json({ success: true, newStock }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
