import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { CartItem } from '@/src/types';

/**
 * Fetch active cart items for a given buyer from Supabase and map them to full CartItem objects.
 */
export async function fetchCart(buyerId: string): Promise<CartItem[]> {
  const supabase = createSupabaseBrowserClient();

  const { data, error } = await supabase
    .from('cart_items')
    .select(`
      quantity,
      store_products (
        id,
        price_per_unit,
        wholesale_price,
        stock,
        store_id,
        catalog_products ( name, image_url, categories ( name ) ),
        stores ( name, marketplace_id ),
        measurement_units ( abbreviation )
      )
    `)
    .eq('buyer_id', buyerId)
    .eq('status', 'active');

  if (error) {
    throw error;
  }

  if (!data) return [];

  // Map database response to CartItem type
  return data.map((item: any) => {
    const sp = item.store_products;
    return {
      id: sp.id,
      name: sp.catalog_products?.name || 'Producto',
      cat: sp.catalog_products?.categories?.name || 'Sin Categoría',
      retailPrice: sp.price_per_unit || 0,
      wsPrice: sp.wholesale_price || sp.price_per_unit || 0,
      stock: sp.stock || 0,
      unit: sp.measurement_units?.abbreviation || 'und',
      emoji: sp.catalog_products?.emoji || '📦',
      image: sp.catalog_products?.image_url || null,
      plazaId: 1, // Default or mock if not present
      storeId: sp.store_id,
      storeName: sp.stores?.name || 'Tienda',
      qty: item.quantity,
      wsMin: sp.wholesale_min_qty || 0,
      minStock: sp.min_order_qty || 0,
      desc: sp.description || '',
      status: sp.is_active ? 'active' : 'inactive',
    } as unknown as CartItem;
  });
}

/**
 * Insert or update a cart item quantity in the database.
 */
export async function addToCartDb(
  buyerId: string,
  storeProductId: string,
  quantity: number
): Promise<void> {
  const supabase = createSupabaseBrowserClient();

  // Buscar item activo existente
  const { data: existing, error: findError } = await supabase
    .from('cart_items')
    .select('id, quantity')
    .eq('buyer_id', buyerId)
    .eq('store_product_id', storeProductId)
    .eq('status', 'active')
    .maybeSingle();

  if (findError) throw findError;

  if (existing) {
    const { error: updateError } = await supabase
      .from('cart_items')
      .update({
        quantity: existing.quantity + quantity,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (updateError) throw updateError;
  } else {
    const { error: insertError } = await supabase
      .from('cart_items')
      .insert({
        buyer_id: buyerId,
        store_product_id: storeProductId,
        quantity,
        status: 'active',
      });

    if (insertError) throw insertError;
  }
}

/**
 * Update the quantity of a cart item.
 */
export async function updateCartQtyDb(buyerId: string, storeProductId: string, quantity: number): Promise<void> {
  const supabase = createSupabaseBrowserClient();

  const { error } = await supabase
    .from('cart_items')
    .update({ quantity: quantity, updated_at: new Date().toISOString() })
    .eq('buyer_id', buyerId)
    .eq('store_product_id', storeProductId)
    .eq('status', 'active');

  if (error) throw error;
}

/**
 * Remove an item from the active cart.
 */
export async function removeFromCartDb(buyerId: string, storeProductId: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();

  const { error } = await supabase
    .from('cart_items')
    .delete()
    .eq('buyer_id', buyerId)
    .eq('store_product_id', storeProductId)
    .eq('status', 'active');

  if (error) throw error;
}

/**
 * Clear the active cart.
 */
export async function clearCartDb(buyerId: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();

  const { error } = await supabase
    .from('cart_items')
    .delete()
    .eq('buyer_id', buyerId)
    .eq('status', 'active');

  if (error) throw error;
}

/**
 * Mark specified active cart items as pending and link them to an order.
 */
export async function checkoutCartDb(buyerId: string, orderId: string, storeProductIds: string[]): Promise<void> {
  const supabase = createSupabaseBrowserClient();

  const { error } = await supabase
    .from('cart_items')
    .update({
      status: 'pending',
      order_id: orderId,
      updated_at: new Date().toISOString(),
    })
    .eq('buyer_id', buyerId)
    .eq('status', 'active')
    .in('store_product_id', storeProductIds);

  if (error) throw error;
}

/**
 * Revert pending cart items back to active status (e.g. if payment is rejected).
 */
export async function revertCartDb(orderId: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();

  const { data: pendingItems, error: fetchError } = await supabase
    .from('cart_items')
    .select('id, buyer_id, store_product_id, quantity')
    .eq('order_id', orderId);

  if (fetchError) throw fetchError;
  if (!pendingItems) return;

  for (const item of pendingItems) {
    const { data: activeItem, error: activeError } = await supabase
      .from('cart_items')
      .select('id, quantity')
      .eq('buyer_id', item.buyer_id)
      .eq('store_product_id', item.store_product_id)
      .eq('status', 'active')
      .maybeSingle();

    if (activeError) throw activeError;

    if (activeItem) {
      const { error: updateError } = await supabase
        .from('cart_items')
        .update({ quantity: activeItem.quantity + item.quantity, updated_at: new Date().toISOString() })
        .eq('id', activeItem.id);

      if (updateError) throw updateError;

      const { error: deleteError } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', item.id);

      if (deleteError) throw deleteError;
    } else {
      const { error: updateError } = await supabase
        .from('cart_items')
        .update({ status: 'active', order_id: null, updated_at: new Date().toISOString() })
        .eq('id', item.id);

      if (updateError) throw updateError;
    }
  }
}

/**
 * Delete pending cart items permanently (e.g. if payment is approved).
 */
export async function deleteCartForOrderDb(orderId: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();

  const { error } = await supabase
    .from('cart_items')
    .delete()
    .eq('order_id', orderId);

  if (error) throw error;
}
