import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database_generated';
import { validateMasterRow, type MasterBatchRow, type MasterErrors } from './master-grid';

type CatalogUpdate = Database['public']['Tables']['catalog_products']['Update'];

const CHUNK = 200;
const PARALLEL = 10;

export type SaveMasterResult =
  | { status: 'ok'; saved: string[]; errors: MasterErrors }
  | { status: 'invalid'; errors: MasterErrors };

function chunks<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

async function idsQueExisten(
  supabase: SupabaseClient<Database>,
  tabla: 'catalog_products' | 'categories' | 'measurement_units' | 'store_groups',
  ids: string[],
  soloActivas = false
): Promise<Set<string>> {
  const out = new Set<string>();
  for (const parte of chunks(ids, CHUNK)) {
    // Las cuatro tablas tienen `id`; solo `categories` se filtra por activa.
    const base = (supabase as SupabaseClient<any>).from(tabla).select('id').in('id', parte);
    const { data, error } = await (soloActivas ? base.eq('is_active', true) : base);
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as { id: string }[]) out.add(r.id);
  }
  return out;
}

/**
 * Guarda los cambios de la tabla del catálogo maestro. Quien llama ya comprobó
 * el permiso (`master-catalog` / `update`).
 *
 * Vuelve a validar cada fila y que existan el producto, la categoría (activa),
 * la unidad y el grupo. Si algo está mal no guarda nada y devuelve los errores
 * por celda. Después actualiza producto por producto: si uno falla, los demás
 * quedan y ese vuelve como error de su fila. No toca slug, foto ni código.
 */
export async function saveMasterBatch(supabase: SupabaseClient<Database>, rows: MasterBatchRow[]): Promise<SaveMasterResult> {
  const unicos = <K extends keyof MasterBatchRow>(k: K) =>
    [...new Set(rows.map((r) => r[k]).filter((v): v is NonNullable<MasterBatchRow[K]> => typeof v === 'string' && v !== ''))] as string[];

  const [productos, categorias, unidades, grupos] = await Promise.all([
    idsQueExisten(supabase, 'catalog_products', rows.map((r) => r.id)),
    idsQueExisten(supabase, 'categories', unicos('category_id'), true),
    idsQueExisten(supabase, 'measurement_units', unicos('default_unit_id')),
    idsQueExisten(supabase, 'store_groups', unicos('owner_group_id')),
  ]);

  const invalidos: MasterErrors = {};
  for (const row of rows) {
    const e = validateMasterRow(row);
    if (!productos.has(row.id)) e.name = 'Este producto ya no existe.';
    if (row.category_id && !categorias.has(row.category_id)) e.category = 'Esa categoría no existe o está inactiva.';
    if (row.default_unit_id && !unidades.has(row.default_unit_id)) e.unit = 'Esa unidad no existe.';
    if (row.owner_group_id && !grupos.has(row.owner_group_id)) e.group = 'Ese grupo no existe.';
    if (Object.keys(e).length > 0) invalidos[row.id] = e;
  }
  if (Object.keys(invalidos).length > 0) return { status: 'invalid', errors: invalidos };

  const saved: string[] = [];
  const errors: MasterErrors = {};
  const guardar = async (row: MasterBatchRow) => {
    const update: CatalogUpdate = {};
    if (row.name !== undefined) update.name = row.name;
    if (row.category_id !== undefined) update.category_id = row.category_id;
    if (row.default_unit_id !== undefined) update.default_unit_id = row.default_unit_id;
    if (row.iva_rate !== undefined) update.iva_rate = row.iva_rate;
    if (row.owner_group_id !== undefined) update.owner_group_id = row.owner_group_id;
    if (row.is_active !== undefined) update.is_active = row.is_active;
    if (row.description !== undefined) update.description = row.description;
    if (Object.keys(update).length === 0) return;

    const { error } = await supabase.from('catalog_products').update(update).eq('id', row.id);
    if (error) errors[row.id] = { name: `No se pudo guardar: ${error.message}` };
    else saved.push(row.id);
  };
  for (const grupo of chunks(rows, PARALLEL)) await Promise.all(grupo.map(guardar));

  return { status: 'ok', saved, errors };
}
