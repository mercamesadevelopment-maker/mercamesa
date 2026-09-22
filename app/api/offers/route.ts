import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { Database } from '../../../types/database_generated';
import { getSupabaseImageUrl, PRESET_PRODUCT_CARD } from '../../../lib/supabase/supabase-image';
import { createNotification } from '../../../lib/notifications/create-notification';
import { canManageStore } from '@/lib/auth/can-manage-store';
import { parseAmount, validateOffer } from '@/lib/offers/validate-offer';
import { findOverlappingOffer } from '@/lib/offers/find-overlapping-offer';

type StoreOfferInsert = Database['public']['Tables']['store_offers']['Insert'];

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get('store_id');

  let query = supabase.from('store_offers').select(`
    *,
    store_products!inner (
      id,
      store_id,
      price_per_unit,
      stock,
      unit_id,
      catalog_products ( name, image_url ),
      stores ( name ),
      measurement_units ( abbreviation )
    )
  `);

  if (storeId) {
    query = query.eq('store_products.store_id', storeId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // URLs públicas de los derivados pre-generados (síncrono, sin llamadas de red
  // ni cupo de transformaciones — antes usaba createSignedUrl por oferta, lo
  // que además impedía cualquier caché de CDN al cambiar en cada request).
  const offersWithImageUrls = (data || []).map((offer: any) => {
    const imgPath = offer.store_products?.catalog_products?.image_url;
    const imageSignedUrl = imgPath ? getSupabaseImageUrl('products', imgPath, PRESET_PRODUCT_CARD) : null;
    return { ...offer, imageSignedUrl };
  });

  return NextResponse.json({ data: offersWithImageUrls }, { status: 200 });
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Destacar una oferta es una decisión editorial exclusiva del admin:
    // se ignora is_featured del body si el usuario no tiene ese rol, sin
    // confiar en lo que mande el cliente.
    const { data: requesterProfile } = await supabase
      .from('profiles')
      .select('roles ( name )')
      .eq('id', user.id)
      .single();
    const requesterRole = (requesterProfile?.roles as any)?.name;
    const canFeature = requesterRole === 'admin' || requesterRole === 'superadmin';

    if (!body.store_product_id) {
      return NextResponse.json({ error: 'Debes escoger un producto.' }, { status: 400 });
    }

    // El producto manda: de él salen la tienda (para autorizar) y el precio del
    // inventario (para validar que la oferta realmente descuente).
    const { data: storeProduct } = await supabase
      .from('store_products')
      .select('id, store_id, price_per_unit')
      .eq('id', body.store_product_id)
      .maybeSingle();

    if (!storeProduct) {
      return NextResponse.json({ error: 'El producto seleccionado no existe.' }, { status: 404 });
    }

    // Antes bastaba con estar autenticado: cualquiera podía crear ofertas sobre
    // los productos de cualquier tienda.
    if (!(await canManageStore(supabase, storeProduct.store_id, user.id))) {
      return NextResponse.json(
        { error: 'No tienes permisos sobre esta tienda.' },
        { status: 403 }
      );
    }

    const discountPct = parseAmount(body.discount_pct);
    const specialPrice = parseAmount(body.special_price);

    const invalid = validateOffer(
      { discountPct, specialPrice, startsAt: body.starts_at, endsAt: body.ends_at || null },
      { pricePerUnit: Number(storeProduct.price_per_unit) }
    );
    if (invalid) {
      return NextResponse.json({ error: invalid }, { status: 400 });
    }

    const overlap = await findOverlappingOffer(
      supabase,
      body.store_product_id,
      body.starts_at,
      body.ends_at || null
    );
    if (overlap) {
      return NextResponse.json({ error: overlap }, { status: 409 });
    }

    const insertData: StoreOfferInsert = {
      store_product_id: body.store_product_id,
      label: body.label || null,
      discount_pct: discountPct,
      special_price: specialPrice,
      starts_at: body.starts_at,
      ends_at: body.ends_at || null,
      status: 'pending',
      is_featured: canFeature ? (body.is_featured ?? false) : false,
    };

    const { data, error } = await supabase
      .from('store_offers')
      .insert(insertData)
      .select('*, store_products ( store_id, catalog_products ( name ), stores ( name ) )')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    try {
      const { data: admins } = await supabase
        .from('profiles')
        .select('id, roles!inner ( name )')
        .in('roles.name', ['admin', 'superadmin']);

      const adminIds = (admins || []).map((a) => a.id);
      const productName = (data as any)?.store_products?.catalog_products?.name || 'un producto';
      const storeName = (data as any)?.store_products?.stores?.name || 'una tienda';

      await createNotification({
        type: 'store_offer_pending',
        title: 'Nueva oferta pendiente de revisión',
        message: `${storeName} creó una oferta para "${productName}" que está esperando tu aprobación.`,
        entityType: 'store_offer',
        entityId: data.id,
        createdBy: user.id,
        recipientUserIds: adminIds,
      });
    } catch (notifErr) {
      console.error('Error notificando a admins sobre nueva oferta:', notifErr);
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
