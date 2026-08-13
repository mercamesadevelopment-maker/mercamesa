import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/require-permission';

/**
 * PostgREST manda los ids del `in.(...)` en la URL, y la puerta de enlace de
 * Supabase la corta alrededor de los 24 KB devolviendo un 400 con el cuerpo
 * "Bad Request", sin JSON ni motivo. Medido contra el proyecto: 650 uuids
 * (24.133 caracteres) pasan y 687 (25.502) fallan.
 *
 * Con ~37 caracteres por uuid codificado, 100 ids son unos 3,8 KB: muy por
 * debajo del corte, y sigue siendo un solo UPDATE por bloque.
 *
 * Sin esto, marcar un puñado de productos funcionaba y marcar una selección
 * grande fallaba sin explicación posible para el usuario.
 */
const UPDATE_CHUNK_SIZE = 100;

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

    let updated = 0;

    for (let index = 0; index < productIds.length; index += UPDATE_CHUNK_SIZE) {
      const chunk = productIds.slice(index, index + UPDATE_CHUNK_SIZE);

      const { data, error } = await supabase
        .from('catalog_products')
        .update({ owner_group_id: ownerGroupId })
        .in('id', chunk)
        .select('id');

      if (error) {
        // Se informa lo ya aplicado: la operación es idempotente, así que
        // reintentarla sobre la misma selección no duplica nada.
        return NextResponse.json(
          {
            error: `${error.message} (se alcanzaron a actualizar ${updated} de ${productIds.length} productos)`,
          },
          { status: 400 }
        );
      }

      updated += data?.length ?? 0;
    }

    return NextResponse.json({ updated }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
