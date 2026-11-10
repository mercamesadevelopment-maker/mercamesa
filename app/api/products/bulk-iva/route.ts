import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/require-permission';
import { bulkProductIds, updateCatalogProducts } from '@/lib/catalog/bulk-update';
import { IVA_INVALIDO, parseIvaRate } from '@/lib/pricing/iva';

/**
 * Cambia la tarifa de IVA de varios productos del catálogo a la vez. Es lo que
 * se usa si una reforma grava productos que ya están cargados: la carga masiva
 * solo crea productos nuevos y omite los que ya existen.
 *
 * Los pedidos ya hechos no cambian: cada uno guardó la tarifa al comprar.
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();

    // catalog_products no tiene RLS: esta verificación es el control de acceso.
    const denied = await requirePermission(
      supabase,
      'master-catalog',
      'update',
      'No tienes permisos para editar productos del catálogo'
    );
    if (denied) return denied;

    const body = await request.json();

    const productIds = bulkProductIds(body);
    if (!productIds) {
      return NextResponse.json({ error: 'No se recibió ningún producto.' }, { status: 400 });
    }

    // Aquí el campo es obligatorio: vacío no puede significar «0 %» sin querer.
    const ivaRate = body.iva_rate === undefined || body.iva_rate === '' ? null : parseIvaRate(body.iva_rate);
    if (ivaRate === null) return NextResponse.json({ error: IVA_INVALIDO }, { status: 400 });

    const result = await updateCatalogProducts(supabase, productIds, { iva_rate: ivaRate });
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

    return NextResponse.json({ updated: result.updated }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
