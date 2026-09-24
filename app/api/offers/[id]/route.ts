import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { Database } from '../../../../types/database_generated';
import { createNotification } from '../../../../lib/notifications/create-notification';
import { canManageStore } from '@/lib/auth/can-manage-store';
import { parseAmount, validateOffer } from '@/lib/offers/validate-offer';
import { findOverlappingOffer } from '@/lib/offers/find-overlapping-offer';

type StoreOfferUpdate = Database['public']['Tables']['store_offers']['Update'];

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  verified: 'Verificada',
  active: 'Activa',
  inactive: 'Inactiva',
};

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

    // Destacar una oferta es una decisión editorial exclusiva del admin:
    // se ignora is_featured del body si el usuario no tiene ese rol.
    const { data: requesterProfile } = await supabase
      .from('profiles')
      .select('roles ( name )')
      .eq('id', user.id)
      .single();
    const requesterRole = (requesterProfile?.roles as any)?.name;
    const isAdmin = requesterRole === 'admin' || requesterRole === 'superadmin';

    // La oferta que se va a editar, con su producto y su tienda actuales.
    const { data: existing } = await supabase
      .from('store_offers')
      .select('id, store_product_id, starts_at, ends_at, discount_pct, special_price, store_products ( store_id, price_per_unit )')
      .eq('id', id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: 'La oferta no existe.' }, { status: 404 });
    }

    const currentStoreId = (existing as any)?.store_products?.store_id;
    if (!currentStoreId || !(await canManageStore(supabase, currentStoreId, user.id))) {
      return NextResponse.json({ error: 'No tienes permisos sobre esta oferta.' }, { status: 403 });
    }

    // Mover la oferta a otro producto puede sacarla de la tienda: hay que poder
    // gestionar también el destino, o sería una vía para escribir en tiendas
    // ajenas.
    let targetProductId = existing.store_product_id;
    let pricePerUnit = Number((existing as any)?.store_products?.price_per_unit ?? 0);

    if (body.store_product_id !== undefined && body.store_product_id !== existing.store_product_id) {
      const { data: target } = await supabase
        .from('store_products')
        .select('id, store_id, price_per_unit')
        .eq('id', body.store_product_id)
        .maybeSingle();

      if (!target) {
        return NextResponse.json({ error: 'El producto seleccionado no existe.' }, { status: 404 });
      }
      if (!(await canManageStore(supabase, target.store_id, user.id))) {
        return NextResponse.json(
          { error: 'No tienes permisos sobre la tienda de ese producto.' },
          { status: 403 }
        );
      }

      targetProductId = target.id;
      pricePerUnit = Number(target.price_per_unit);
    }

    const discountPct =
      body.discount_pct !== undefined ? parseAmount(body.discount_pct) : existing.discount_pct;
    const specialPrice =
      body.special_price !== undefined ? parseAmount(body.special_price) : existing.special_price;
    const startsAt = body.starts_at !== undefined ? body.starts_at : existing.starts_at;
    const endsAt = body.ends_at !== undefined ? body.ends_at || null : existing.ends_at;

    const invalid = validateOffer(
      { discountPct, specialPrice, startsAt, endsAt },
      { pricePerUnit }
    );
    if (invalid) {
      return NextResponse.json({ error: invalid }, { status: 400 });
    }

    const overlap = await findOverlappingOffer(supabase, targetProductId, startsAt, endsAt, id);
    if (overlap) {
      return NextResponse.json({ error: overlap }, { status: 409 });
    }

    const updateData: StoreOfferUpdate = {
      store_product_id: targetProductId,
      discount_pct: discountPct,
      special_price: specialPrice,
      starts_at: startsAt,
      ends_at: endsAt,
    };

    if (body.label !== undefined) updateData.label = body.label || null;
    if (body.is_featured !== undefined && isAdmin) updateData.is_featured = Boolean(body.is_featured);

    // El estado es la aprobación de la plataforma. Que el tendero no lo vea en
    // su formulario no bastaba: la ruta lo aceptaba de cualquiera, así que se
    // podía auto-aprobar una oferta con una llamada directa.
    if (body.status !== undefined) {
      if (!isAdmin) {
        return NextResponse.json(
          { error: 'Solo el equipo de MercaMesa puede cambiar el estado de una oferta.' },
          { status: 403 }
        );
      }
      updateData.status = body.status;
    }

    const { data, error } = await supabase
      .from('store_offers')
      .update(updateData)
      .eq('id', id)
      .select('*, store_products ( store_id, catalog_products ( name ), stores ( name ) )')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (body.status !== undefined) {
      try {
        const storeId = (data as any)?.store_products?.store_id;
        const productName = (data as any)?.store_products?.catalog_products?.name || 'tu oferta';
        const storeName = (data as any)?.store_products?.stores?.name || 'tu tienda';

        if (storeId) {
          const { data: members } = await supabase
            .from('store_members')
            .select('user_id')
            .eq('store_id', storeId);

          const recipientUserIds = (members || []).map((m) => m.user_id);

          await createNotification({
            type: 'store_offer_reviewed',
            title: 'Actualización de tu oferta',
            message: `La oferta de "${productName}" en ${storeName} ahora está: ${STATUS_LABELS[body.status] || body.status}.`,
            entityType: 'store_offer',
            entityId: id,
            createdBy: user.id,
            recipientUserIds,
          });
        }
      } catch (notifErr) {
        console.error('Error notificando cambio de estado de oferta:', notifErr);
      }
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

    // Igual que el PUT: sin esto, cualquier autenticado borraba ofertas ajenas.
    const { data: existing } = await supabase
      .from('store_offers')
      .select('id, store_products ( store_id )')
      .eq('id', id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: 'La oferta no existe.' }, { status: 404 });
    }

    const storeId = (existing as any)?.store_products?.store_id;
    if (!storeId || !(await canManageStore(supabase, storeId, user.id))) {
      return NextResponse.json({ error: 'No tienes permisos sobre esta oferta.' }, { status: 403 });
    }

    const { error } = await supabase.from('store_offers').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Deleted successfully' }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
