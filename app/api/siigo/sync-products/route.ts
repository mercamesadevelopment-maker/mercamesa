import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { requirePermission } from '@/lib/auth/require-permission';
import { createProduct } from '@/lib/siigo/services/products/product.service';

/**
 * Sube al catálogo de Siigo los productos que todavía no existen allá.
 *
 * `POST /v1/invoices` exige que `items[].code` exista y esté activo en Siigo. En
 * producción hay ~2.400 productos comprables que nunca se subieron: sin esto,
 * cualquier compra de uno de ellos falla al facturar con `invalid_code`.
 *
 * El código que se usa es `catalog_products.siigo_id`, que ya se venía
 * generando con el formato exacto que Siigo pide (alfanumérico, ≤30, único).
 */
export const maxDuration = 60;

/** Grupo contable "Productos". GET /v1/account-groups */
const ACCOUNT_GROUP_ID = Number.parseInt(process.env.SIIGO_ACCOUNT_GROUP_ID || '1303', 10);

/**
 * Siigo limita a 100 peticiones por minuto por empresa y no tiene creación
 * masiva de productos, así que se sube por tandas y la ruta se vuelve a llamar
 * hasta que no queden pendientes. Mejor eso que agotar el tiempo de la función.
 */
const BATCH_SIZE = 60;

interface PendingProduct {
  id: string;
  name: string;
  siigo_id: string;
  measurement_units: { name: string } | null;
}

export async function POST() {
  try {
    const supabase = await createClient();

    const denied = await requirePermission(
      supabase,
      'system-settings',
      'create',
      'No tienes permisos para sincronizar el catálogo con Siigo'
    );
    if (denied) return denied;

    // Se escribe con service role: marcar `siigo_synced_at` es una operación del
    // sistema y catalog_products no tiene RLS.
    const service = createSupabaseServiceClient();

    const { data: pending, error } = await service
      .from('catalog_products')
      .select('id, name, siigo_id, measurement_units ( name )')
      .eq('is_active', true)
      .is('siigo_synced_at', null)
      .order('id')
      .limit(BATCH_SIZE);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const rows = (pending ?? []) as unknown as PendingProduct[];

    let created = 0;
    let alreadyThere = 0;
    const failures: { name: string; error: string }[] = [];

    for (const product of rows) {
      try {
        const result = await createProduct({
          code: product.siigo_id,
          name: product.name,
          account_group: ACCOUNT_GROUP_ID,
          type: 'Product',
          // El inventario se lleva en Mercamesa (store_products.stock), no en
          // Siigo. Es también la forma de los 506 productos ya sincronizados.
          stock_control: false,
          active: true,
          unit_label: product.measurement_units?.name || 'Unidad',
        });

        // `already_exists` cuenta como sincronizado: son los que alguien subió
        // antes de esta integración, y hay que reconciliarlos, no duplicarlos.
        await service
          .from('catalog_products')
          .update({ siigo_synced_at: new Date().toISOString() })
          .eq('id', product.id);

        if (result.alreadyExists) alreadyThere++;
        else created++;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        failures.push({ name: product.name, error: message.slice(0, 500) });
        console.error(`Error sincronizando "${product.name}" con Siigo:`, message);
      }
    }

    const { count: remaining } = await service
      .from('catalog_products')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .is('siigo_synced_at', null);

    return NextResponse.json(
      {
        processed: rows.length,
        created,
        already_in_siigo: alreadyThere,
        failed: failures.length,
        failures,
        remaining: remaining ?? 0,
        // El cliente vuelve a llamar mientras queden pendientes.
        done: (remaining ?? 0) === 0,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Cuántos productos faltan por subir a Siigo. */
export async function GET() {
  try {
    const supabase = await createClient();

    const denied = await requirePermission(
      supabase,
      'system-settings',
      'read',
      'No tienes permisos para consultar la sincronización con Siigo'
    );
    if (denied) return denied;

    const service = createSupabaseServiceClient();

    const [{ count: total }, { count: pending }] = await Promise.all([
      service.from('catalog_products').select('id', { count: 'exact', head: true }).eq('is_active', true),
      service
        .from('catalog_products')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .is('siigo_synced_at', null),
    ]);

    return NextResponse.json(
      { total: total ?? 0, pending: pending ?? 0, synced: (total ?? 0) - (pending ?? 0) },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
