import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database_generated';
import { canManageStore } from '@/lib/auth/can-manage-store';
import { validateRow, type PriceBatchRow, type PriceErrors, type PriceValues } from './price-grid';

type StoreProductUpdate = Database['public']['Tables']['store_products']['Update'];
type MovementInsert = Database['public']['Tables']['product_stock_movements']['Insert'];

/** Ids por consulta: `.in()` va en la URL y no puede ser muy larga. */
const CHUNK = 200;
/** Productos que se actualizan a la vez. */
const PARALLEL = 10;

export type SavePriceBatchResult =
  | { status: 'ok'; saved: string[]; errors: PriceErrors }
  | { status: 'forbidden'; message: string }
  | { status: 'invalid'; errors: PriceErrors };

function chunks<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

const fmt = (n: number) => String(n).replace('.', ',');

/**
 * Guarda los cambios de la tabla de productos del tendero.
 *
 * 1. Carga los productos y exige que el usuario maneje **todas** sus tiendas;
 *    si alguna no es suya, no guarda nada.
 * 2. Vuelve a validar cada fila contra lo guardado (no confía en el navegador).
 *    Si alguna está mal, no guarda nada y devuelve los errores por celda.
 * 3. Actualiza producto por producto. Un cambio de stock deja su ajuste en la
 *    bitácora (`product_stock_movements`), igual que el modal de movimiento.
 *
 * No es todo o nada en la base: si un producto falla al actualizar, los demás
 * quedan guardados y ese vuelve como error de su fila.
 */
export async function savePriceBatch(
  supabase: SupabaseClient<Database>,
  userId: string,
  rows: PriceBatchRow[]
): Promise<SavePriceBatchResult> {
  const ids = rows.map((r) => r.id);
  const actuales = new Map<string, { storeId: string; values: PriceValues }>();

  for (const parte of chunks(ids, CHUNK)) {
    const { data, error } = await supabase
      .from('store_products')
      .select('id, store_id, unit_id, price_per_unit, wholesale_price, wholesale_min_qty, stock, is_active')
      .in('id', parte);
    if (error) throw new Error(error.message);
    for (const p of data ?? []) {
      actuales.set(p.id, {
        storeId: p.store_id,
        values: {
          unitId: p.unit_id ?? null,
          price: Number(p.price_per_unit),
          wsPrice: p.wholesale_price === null ? null : Number(p.wholesale_price),
          wsMin: p.wholesale_min_qty === null ? null : Number(p.wholesale_min_qty),
          stock: Number(p.stock ?? 0),
          isActive: Boolean(p.is_active),
        },
      });
    }
  }

  // Un id que no se ve (RLS) o no existe se trata igual que uno ajeno.
  if (actuales.size !== ids.length) {
    return { status: 'forbidden', message: 'Hay productos que no existen o no son de tus tiendas.' };
  }
  const tiendas = [...new Set([...actuales.values()].map((a) => a.storeId))];
  for (const storeId of tiendas) {
    if (!(await canManageStore(supabase, storeId, userId))) {
      return { status: 'forbidden', message: 'No tienes permisos sobre todas las tiendas de estos productos.' };
    }
  }

  // Las unidades pedidas tienen que existir.
  const unidades = [...new Set(rows.map((r) => r.unit_id).filter((u): u is string => Boolean(u)))];
  const unidadesValidas = new Set<string>();
  if (unidades.length > 0) {
    const { data, error } = await supabase.from('measurement_units').select('id').in('id', unidades);
    if (error) throw new Error(error.message);
    for (const u of data ?? []) unidadesValidas.add(u.id);
  }

  const invalidos: PriceErrors = {};
  for (const row of rows) {
    const e = validateRow(row, actuales.get(row.id)!.values);
    if (row.unit_id && !unidadesValidas.has(row.unit_id)) e.unit = 'Esa unidad de medida no existe.';
    if (Object.keys(e).length > 0) invalidos[row.id] = e;
  }
  if (Object.keys(invalidos).length > 0) return { status: 'invalid', errors: invalidos };

  const saved: string[] = [];
  const errors: PriceErrors = {};
  const movimientos: MovementInsert[] = [];
  const ahora = new Date().toISOString();

  const guardar = async (row: PriceBatchRow) => {
    const { storeId, values } = actuales.get(row.id)!;
    const update: StoreProductUpdate = {};
    if (row.price_per_unit !== undefined) update.price_per_unit = row.price_per_unit;
    if (row.wholesale_price !== undefined) update.wholesale_price = row.wholesale_price;
    if (row.wholesale_min_qty !== undefined) update.wholesale_min_qty = row.wholesale_min_qty;
    if (row.stock !== undefined) update.stock = row.stock;
    if (row.unit_id !== undefined) update.unit_id = row.unit_id;
    if (row.is_active !== undefined) update.is_active = row.is_active;
    if (row.price_per_unit !== undefined || row.wholesale_price !== undefined) update.last_price_update = ahora;
    if (Object.keys(update).length === 0) return;

    const { error } = await supabase.from('store_products').update(update).eq('id', row.id);
    if (error) {
      errors[row.id] = { price: `No se pudo guardar: ${error.message}` };
      return;
    }
    saved.push(row.id);

    if (row.stock !== undefined && row.stock !== values.stock) {
      movimientos.push({
        store_product_id: row.id,
        store_id: storeId,
        type: 'adjustment',
        quantity: Math.abs(row.stock - values.stock),
        reference_type: 'adjustment_manual',
        notes: `Ajuste desde la tabla: ${fmt(values.stock)} → ${fmt(row.stock)}`,
        registered_by: userId,
      });
    }
  };

  for (const grupo of chunks(rows, PARALLEL)) await Promise.all(grupo.map(guardar));

  if (movimientos.length > 0) {
    const { error } = await supabase.from('product_stock_movements').insert(movimientos);
    // El stock ya quedó; la bitácora no debe tumbar el guardado, como en el modal.
    if (error) console.error('No se pudo registrar el ajuste de stock:', error.message);
  }

  return { status: 'ok', saved, errors };
}
