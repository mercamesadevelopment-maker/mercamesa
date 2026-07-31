import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { CartItem } from '@/src/types';
import { getSupabaseImageUrl, PRESET_THUMBNAIL } from '@/lib/supabase/supabase-image';

/**
 * Fetch active cart items for a given buyer from Supabase and map them to full CartItem objects,
 * verifying offer validity and measurement units.
 */
export async function fetchCart(buyerId: string): Promise<CartItem[]> {
  const supabase = createSupabaseBrowserClient();
  const now = new Date();

  const { data, error } = await supabase
    .from('cart_items')
    .select(`
      id,
      quantity,
      offer_id,
      notes,
      store_products (
        id,
        price_per_unit,
        wholesale_price,
        stock,
        store_id,
        unit_id,
        catalog_products ( name, image_url, categories ( name ) ),
        stores ( name, marketplace_id ),
        measurement_units ( id, name, abbreviation ),
        store_offers ( id, discount_pct, special_price, label, starts_at, ends_at, status )
      )
    `)
    .eq('buyer_id', buyerId)
    .eq('status', 'active');

  if (error) {
    throw error;
  }

  if (!data) return [];

  const itemsToUpdateOfferNull: string[] = [];

  const resultCart: CartItem[] = data.map((item: any) => {
    const sp = item.store_products;
    const imageUrl = sp?.catalog_products?.image_url
      ? getSupabaseImageUrl('products', sp.catalog_products.image_url, PRESET_THUMBNAIL)
      : null;

    let retailPrice = Number(sp?.price_per_unit || 0);
    let wsPrice = Number(sp?.wholesale_price || sp?.price_per_unit || 0);
    let offerExpired = false;
    let originalOfferPrice: number | undefined = undefined;
    let validOfferId: string | null = item.offer_id || null;

    // Verificar si el ítem tenía una oferta vinculada o si hay ofertas en store_offers
    const offersList = Array.isArray(sp?.store_offers) ? sp.store_offers : [];

    if (item.offer_id) {
      const linkedOffer = offersList.find((o: any) => o.id === item.offer_id);

      const isStillValid =
        linkedOffer &&
        linkedOffer.status === 'active' &&
        new Date(linkedOffer.starts_at) <= now &&
        (!linkedOffer.ends_at || new Date(linkedOffer.ends_at) >= now);

      if (isStillValid) {
        if (linkedOffer.special_price != null) {
          retailPrice = Number(linkedOffer.special_price);
        } else if (linkedOffer.discount_pct != null) {
          retailPrice = Math.round(retailPrice * (1 - Number(linkedOffer.discount_pct) / 100));
        }
      } else {
        // La oferta expiró durante la permanencia en el carrito
        offerExpired = true;
        validOfferId = null;
        if (linkedOffer) {
          originalOfferPrice = linkedOffer.special_price != null ? Number(linkedOffer.special_price) : undefined;
        }
        itemsToUpdateOfferNull.push(item.id);
      }
    } else {
      // Buscar si existe alguna oferta activa vigente para aplicar por defecto
      const activeOffer = offersList.find(
        (o: any) =>
          o.status === 'active' &&
          new Date(o.starts_at) <= now &&
          (!o.ends_at || new Date(o.ends_at) >= now)
      );

      if (activeOffer) {
        validOfferId = activeOffer.id;
        if (activeOffer.special_price != null) {
          retailPrice = Number(activeOffer.special_price);
        } else if (activeOffer.discount_pct != null) {
          retailPrice = Math.round(retailPrice * (1 - Number(activeOffer.discount_pct) / 100));
        }
      }
    }

    return {
      id: sp?.id || item.id,
      name: sp?.catalog_products?.name || 'Producto',
      cat: sp?.catalog_products?.categories?.name || 'Sin Categoría',
      retailPrice,
      wsPrice,
      ws20: Math.floor(retailPrice * 0.75),
      ws50: Math.floor(retailPrice * 0.7),
      stock: Number(sp?.stock || 0),
      unit: sp?.measurement_units?.abbreviation || 'und',
      unitId: sp?.unit_id || sp?.measurement_units?.id || '',
      unitName: sp?.measurement_units?.name || '',
      emoji: sp?.catalog_products?.emoji || '📦',
      image: imageUrl,
      plazaId: 1,
      storeId: sp?.store_id || '',
      storeName: sp?.stores?.name || 'Tienda',
      qty: item.quantity,
      wsMin: Number(sp?.wholesale_min_qty || 0),
      minStock: Number(sp?.min_order_qty || 0),
      desc: sp?.description || '',
      status: sp?.is_active ? 'active' : 'inactive',
      offerId: validOfferId,
      offerExpired,
      originalOfferPrice,
      notes: item.notes || '',
    } as unknown as CartItem;
  });

  // Limpiar asincrónicamente los offer_id vencidos en la base de datos
  if (itemsToUpdateOfferNull.length > 0) {
    supabase
      .from('cart_items')
      .update({ offer_id: null })
      .in('id', itemsToUpdateOfferNull)
      .then(({ error }) => {
        if (error) console.error('Error desvinculando offer_id vencidos:', error);
      });
  }

  return resultCart;
}

/**
 * Insert or update a cart item quantity in the database with optional offerId.
 */
export async function addToCartDb(
  buyerId: string,
  storeProductId: string,
  quantity: number,
  offerId?: string | null
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
        offer_id: offerId || null,
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
        offer_id: offerId || null,
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
 * Update the buyer notes/specifications for a cart item.
 */
export async function updateCartItemNotesDb(buyerId: string, storeProductId: string, notes: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();

  const { error } = await supabase
    .from('cart_items')
    .update({ notes: notes || null, updated_at: new Date().toISOString() })
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
