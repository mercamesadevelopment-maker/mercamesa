import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database_generated';
import {
  PRODUCT_CODE_UNIQUE_INDEX,
  duplicateProductCodeMessage,
  normalizeProductCode,
  validateProductCode,
} from '@/lib/products/product-code';
import { canManageStore } from '@/lib/auth/can-manage-store';
import { EXCLUSIVE_PRODUCT_MESSAGE, findExclusivityViolations } from '@/lib/catalog/visibility';

type StoreProductInsert = Database['public']['Tables']['store_products']['Insert'];

export const MAX_FEATURED_PER_STORE = 5;
export const MAX_FEATURED_MESSAGE = `Ya tienes ${MAX_FEATURED_PER_STORE} productos destacados. Quita uno para destacar otro.`;

export type CreateResult = { ok: true; data: unknown } | { ok: false; status: number; message: string };

const falla = (status: number, message: string): CreateResult => ({ ok: false, status, message });

/** La fila de una tienda que publica un producto. Los números llegan del formulario como texto. */
export function toStoreProductInsert(body: any, now: Date): StoreProductInsert {
  const isFeatured = body.is_featured === true;
  return {
    catalog_product_id: body.catalog_product_id,
    store_id: body.store_id,
    unit_id: body.unit_id,
    price_per_unit: Number(body.price_per_unit),
    stock: Number(body.stock || 0),
    min_order_qty: Number(body.min_order_qty || 1),
    wholesale_price: body.wholesale_price ? Number(body.wholesale_price) : null,
    wholesale_min_qty: body.wholesale_min_qty ? Number(body.wholesale_min_qty) : null,
    is_active: body.is_active ?? true,
    is_featured: isFeatured,
    featured_at: isFeatured ? now.toISOString() : null,
    code: normalizeProductCode(body.code),
  };
}

/**
 * La fila de la asignación masiva del admin. Sin `code` a propósito: el admin no
 * conoce el código interno de cada tienda, y el tendero lo completa al editar.
 */
export function toAssignmentInsert(item: any): StoreProductInsert {
  return {
    catalog_product_id: item.catalog_product_id,
    store_id: item.store_id,
    unit_id: item.unit_id,
    price_per_unit: Number(item.price_per_unit || 0),
    stock: Number(item.stock || 0),
    min_order_qty: Number(item.min_order_qty || 1),
    wholesale_price: item.wholesale_price ? Number(item.wholesale_price) : null,
    wholesale_min_qty: item.wholesale_min_qty ? Number(item.wholesale_min_qty) : null,
    is_active: item.is_active ?? true,
  };
}

/** Las tiendas de una asignación masiva, o el error si viene vacía o a alguna le falta la tienda. */
export function assignmentStoreIds(items: any[]): { storeIds: string[] } | { message: string } {
  if (items.length === 0) return { message: 'No se recibió ningún producto.' };
  const storeIds = Array.from(new Set(items.map((item) => item.store_id).filter(Boolean)));
  if (storeIds.length !== new Set(items.map((item) => item.store_id)).size) {
    return { message: 'Falta el store_id en algún producto.' };
  }
  return { storeIds };
}

/**
 * Asignación masiva del admin (Catálogo → «Asignar Producto a Tienda»): un
 * producto del catálogo a varias tiendas de una.
 */
export async function assignToStores(
  supabase: SupabaseClient<any>,
  userId: string,
  items: any[]
): Promise<CreateResult> {
  const tiendas = assignmentStoreIds(items);
  if ('message' in tiendas) return falla(400, tiendas.message);

  const allowed = await Promise.all(tiendas.storeIds.map((storeId) => canManageStore(supabase, storeId, userId)));
  if (allowed.some((ok) => !ok)) return falla(403, 'No tienes permisos sobre alguna de las tiendas.');

  const violations = await findExclusivityViolations(
    supabase,
    items.map((item) => ({ storeId: item.store_id, catalogProductId: item.catalog_product_id }))
  );
  if (violations.length > 0) {
    return falla(
      403,
      violations.length === items.length
        ? EXCLUSIVE_PRODUCT_MESSAGE
        : `${violations.length} de las tiendas seleccionadas no pueden publicar este producto porque es exclusivo de otro grupo.`
    );
  }

  const { data, error } = await supabase.from('store_products').insert(items.map(toAssignmentInsert)).select();
  if (error) return falla(400, error.message);
  return { ok: true, data };
}

/** Una tienda publica un producto del catálogo. */
export async function createStoreProduct(
  supabase: SupabaseClient<any>,
  userId: string,
  body: any
): Promise<CreateResult> {
  if (!body.store_id || !body.catalog_product_id) {
    return falla(400, 'Faltan store_id o catalog_product_id.');
  }

  // store_products no tiene RLS: esta verificación es el control de acceso, y
  // por acá también se evadía la exclusividad del catálogo.
  if (!(await canManageStore(supabase, body.store_id, userId))) {
    return falla(403, 'No tienes permisos sobre esta tienda.');
  }

  const violations = await findExclusivityViolations(supabase, [
    { storeId: body.store_id, catalogProductId: body.catalog_product_id },
  ]);
  if (violations.length > 0) return falla(403, EXCLUSIVE_PRODUCT_MESSAGE);

  const codeError = validateProductCode(body.code);
  if (codeError) return falla(400, codeError);

  if (body.is_featured === true) {
    const { count, error } = await supabase
      .from('store_products')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', body.store_id)
      .eq('is_featured', true);
    if (error) return falla(400, error.message);
    if ((count ?? 0) >= MAX_FEATURED_PER_STORE) return falla(400, MAX_FEATURED_MESSAGE);
  }

  const { data, error } = await supabase
    .from('store_products')
    .insert(toStoreProductInsert(body, new Date()))
    .select()
    .single();

  if (error) {
    if (error.code === '23505' && error.message.includes(PRODUCT_CODE_UNIQUE_INDEX)) {
      return falla(409, duplicateProductCodeMessage(body.code));
    }
    return falla(400, error.message);
  }
  return { ok: true, data };
}
