import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { Database } from '../../../../types/database_generated';
import { createNotification } from '../../../../lib/notifications/create-notification';

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

    const updateData: StoreOfferUpdate = {};

    if (body.store_product_id !== undefined) updateData.store_product_id = body.store_product_id;
    if (body.label !== undefined) updateData.label = body.label || null;
    if (body.discount_pct !== undefined) updateData.discount_pct = body.discount_pct ? Number(body.discount_pct) : null;
    if (body.special_price !== undefined) updateData.special_price = body.special_price ? Number(body.special_price) : null;
    if (body.starts_at !== undefined) updateData.starts_at = body.starts_at;
    if (body.ends_at !== undefined) updateData.ends_at = body.ends_at || null;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.is_featured !== undefined) updateData.is_featured = Boolean(body.is_featured);

    const { data, error } = await supabase
      .from('store_offers')
      .update(updateData)
      .eq('id', id)
      .select('*, store_products ( store_id, catalog_products ( name ) )')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (body.status !== undefined) {
      try {
        const storeId = (data as any)?.store_products?.store_id;
        const productName = (data as any)?.store_products?.catalog_products?.name || 'tu oferta';

        if (storeId) {
          const { data: members } = await supabase
            .from('store_members')
            .select('user_id')
            .eq('store_id', storeId);

          const recipientUserIds = (members || []).map((m) => m.user_id);

          await createNotification({
            type: 'store_offer_reviewed',
            title: 'Actualización de tu oferta',
            message: `La oferta de "${productName}" ahora está: ${STATUS_LABELS[body.status] || body.status}.`,
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
