import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseImageUrl, PRESET_PRODUCT_CARD } from '@/lib/supabase/supabase-image';
import { resolveOfferPrices } from '@/lib/offers/resolve-offer-prices';

/**
 * Qué se puede volver a pedir de una orden anterior.
 *
 * Los `order_items` guardan el precio y el nombre del día de la compra, así que
 * no sirven para armar el carrito: hay que releer `store_products` para saber el
 * precio y las existencias de hoy. Cada línea se clasifica para que el comprador
 * decida con la información a la vista, en vez de descubrir en el carrito que
 * algo se agotó.
 */
export type ReorderStatus = 'available' | 'partial' | 'out_of_stock' | 'unavailable';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Filtrar por `buyer_id` es lo que impide leer los pedidos de otro.
    const { data: order } = await supabase
      .from('orders')
      .select('id, buyer_id')
      .eq('id', id)
      .eq('buyer_id', user.id)
      .maybeSingle();

    if (!order) {
      return NextResponse.json({ error: 'El pedido no existe.' }, { status: 404 });
    }

    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('store_product_id, catalog_name, unit_name, quantity')
      .eq('order_id', id);

    if (itemsError) {
      console.error('reorder-preview: order_items failed', itemsError);
      return NextResponse.json({ error: 'No se pudo leer el pedido.' }, { status: 500 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ data: { lines: [], storeId: null, storeName: null } }, { status: 200 });
    }

    const productIds = Array.from(
      new Set(items.map((i) => i.store_product_id).filter((v): v is string => !!v))
    );

    // Estado de HOY de esos productos. Los que ya no existan simplemente no
    // vuelven, y se resuelven abajo como 'unavailable'.
    const { data: products } = await supabase
      .from('store_products')
      .select(`
        id, store_id, price_per_unit, wholesale_price, stock, is_active,
        catalog_products ( name, image_url ),
        stores ( name, is_active ),
        measurement_units ( abbreviation )
      `)
      .in('id', productIds);

    const byId = new Map((products || []).map((p) => [p.id, p]));

    // El precio de hoy es el que se va a cobrar: con la oferta vigente, y el
    // mayorista para el comprador mayorista. Es la misma función de la
    // cotización y de la creación del pedido; antes acá se mostraba el precio de
    // inventario y el producto entraba a la canasta sin su descuento.
    const { data: profile } = await supabase
      .from('profiles')
      .select('buyer_type')
      .eq('id', user.id)
      .single();
    const precios = await resolveOfferPrices(
      supabase,
      products || [],
      profile?.buyer_type === 'wholesale'
    );

    let storeId: string | null = null;
    let storeName: string | null = null;

    const lines = items.map((item) => {
      const requested = Number(item.quantity) || 0;
      const product = item.store_product_id ? byId.get(item.store_product_id) : undefined;

      if (!product || !product.is_active || !(product.stores as any)?.is_active) {
        return {
          storeProductId: item.store_product_id,
          name: item.catalog_name,
          unit: item.unit_name,
          requestedQty: requested,
          availableQty: 0,
          status: 'unavailable' as ReorderStatus,
          price: null,
          listPrice: null,
          offerId: null,
          image: null,
          storeId: null,
          storeName: null,
        };
      }

      if (!storeId) {
        storeId = product.store_id;
        storeName = (product.stores as any)?.name ?? null;
      }

      const stock = Number(product.stock) || 0;
      const availableQty = Math.min(requested, stock);

      const status: ReorderStatus =
        stock <= 0 ? 'out_of_stock' : availableQty < requested ? 'partial' : 'available';

      const imagePath = (product.catalog_products as any)?.image_url;
      const precio = precios.get(product.id);

      return {
        storeProductId: product.id,
        name: (product.catalog_products as any)?.name || item.catalog_name,
        unit: (product.measurement_units as any)?.abbreviation || item.unit_name,
        requestedQty: requested,
        availableQty,
        status,
        price: precio?.finalPrice ?? Number(product.price_per_unit),
        // El de antes de la oferta: igual a `price` cuando no hay descuento.
        listPrice: precio?.listPrice ?? Number(product.price_per_unit),
        offerId: precio?.offerId ?? null,
        image: imagePath ? getSupabaseImageUrl('products', imagePath, PRESET_PRODUCT_CARD) : null,
        storeId: product.store_id,
        storeName: (product.stores as any)?.name ?? null,
      };
    });

    return NextResponse.json({ data: { lines, storeId, storeName } }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
