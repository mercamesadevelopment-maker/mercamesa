import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/require-permission';

/**
 * Marca varios productos del catálogo como exclusivos de un grupo de tiendas, o
 * los devuelve a público. Sirve para reclasificar lo que ya está cargado sin
 * abrir el modal uno por uno.
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();

    // catalog_products no tiene RLS: esta verificación es el control de acceso.
    const denied = await requirePermission(
      supabase,
      'system-settings',
      'update',
      'No tienes permisos para editar productos del catálogo'
    );
    if (denied) return denied;

    const body = await request.json();

    if (!Array.isArray(body.product_ids) || body.product_ids.length === 0) {
      return NextResponse.json({ error: 'No se recibió ningún producto.' }, { status: 400 });
    }

    const productIds = body.product_ids.map((value: unknown) => String(value)).filter(Boolean);
    // `null` es un valor válido y significativo: devuelve el producto a público.
    const ownerGroupId = body.owner_group_id ? String(body.owner_group_id) : null;

    if (ownerGroupId) {
      const { data: group } = await supabase
        .from('store_groups')
        .select('id')
        .eq('id', ownerGroupId)
        .maybeSingle();

      if (!group) {
        return NextResponse.json({ error: 'El grupo de tiendas no existe.' }, { status: 400 });
      }
    }

    const { data, error } = await supabase
      .from('catalog_products')
      .update({ owner_group_id: ownerGroupId })
      .in('id', productIds)
      .select('id');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ updated: data?.length ?? 0 }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
