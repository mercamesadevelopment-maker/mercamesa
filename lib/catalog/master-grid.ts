import { parseIvaRate } from '@/lib/pricing/iva';
import { parsePastedBoolean } from '@/lib/utils/pasted-cells';
import { normalizeText } from '@/lib/utils/text';

/**
 * El catálogo maestro (`/admin/products`) como una hoja de cálculo: nombre,
 * categoría, unidad por defecto, IVA, exclusividad, activo y descripción.
 *
 * Funciones puras: las usa la tabla (resaltar y avisar mientras se escribe) y
 * la ruta que guarda (`save-master-batch.ts`), que no confía en el navegador.
 */

export type MasterField = 'name' | 'category' | 'unit' | 'iva' | 'group' | 'isActive' | 'description';

/** Los campos editables, en el orden de las columnas. */
export const MASTER_FIELDS: MasterField[] = ['name', 'category', 'unit', 'iva', 'group', 'isActive', 'description'];

export const MAX_NAME = 200;
export const MAX_DESCRIPTION = 2000;
export const MAX_MASTER_BATCH = 1000;

export interface MasterValues {
  name: string;
  categoryId: string | null;
  unitId: string | null;
  ivaRate: number;
  groupId: string | null;
  isActive: boolean;
  description: string | null;
}

/** Una fila mientras se edita. Ids vacíos = sin valor; el IVA como texto («0.19»). */
export interface MasterDraft {
  id: string;
  name: string;
  category: string;
  unit: string;
  iva: string;
  group: string;
  isActive: boolean;
  description: string;
}

export interface MasterBatchRow {
  id: string;
  name?: string;
  category_id?: string;
  default_unit_id?: string;
  iva_rate?: number;
  owner_group_id?: string | null;
  is_active?: boolean;
  description?: string | null;
}

export type MasterErrors = Record<string, Partial<Record<MasterField, string>>>;

/** Las listas de las columnas de selección, para mostrar y para leer lo pegado. */
export interface MasterOptions {
  /** Subcategorías activas; `label` es «Madre › Sub». */
  categories: { id: string; name: string; label: string }[];
  units: { id: string; name: string; abbreviation: string }[];
  groups: { id: string; name: string }[];
}

export const IVA_OPTIONS = [
  { value: '0', label: '0 %' },
  { value: '0.05', label: '5 %' },
  { value: '0.19', label: '19 %' },
];

export function draftFromMaster(id: string, v: MasterValues): MasterDraft {
  return {
    id,
    name: v.name,
    category: v.categoryId ?? '',
    unit: v.unitId ?? '',
    iva: String(v.ivaRate),
    group: v.groupId ?? '',
    isActive: v.isActive,
    description: v.description ?? '',
  };
}

export function changedMasterFields(original: MasterDraft | undefined, draft: MasterDraft): MasterField[] {
  if (!original) return [];
  return MASTER_FIELDS.filter((f) => original[f] !== draft[f]);
}

/** Las reglas de una fila que ya llegó en su forma de guardar. */
export function validateMasterRow(row: MasterBatchRow): Partial<Record<MasterField, string>> {
  const e: Partial<Record<MasterField, string>> = {};
  if (row.name !== undefined) {
    if (!row.name.trim()) e.name = 'El nombre no puede quedar vacío.';
    else if (row.name.length > MAX_NAME) e.name = `El nombre tiene más de ${MAX_NAME} letras.`;
  }
  if (row.category_id !== undefined && !row.category_id) e.category = 'Elige una categoría.';
  if (row.default_unit_id !== undefined && !row.default_unit_id) e.unit = 'Elige una unidad.';
  if (row.iva_rate !== undefined && parseIvaRate(row.iva_rate) === null) e.iva = 'El IVA es 0 %, 5 % o 19 %.';
  if (row.description !== undefined && row.description !== null && row.description.length > MAX_DESCRIPTION) {
    e.description = `La descripción tiene más de ${MAX_DESCRIPTION} letras.`;
  }
  return e;
}

/** Una fila editada como lo que se guarda (solo lo cambiado), con sus errores. */
export function masterRowFromDraft(
  original: MasterDraft,
  draft: MasterDraft
): { row: MasterBatchRow | null; errors: Partial<Record<MasterField, string>> } {
  const campos = changedMasterFields(original, draft);
  if (campos.length === 0) return { row: null, errors: {} };

  const row: MasterBatchRow = { id: draft.id };
  const errors: Partial<Record<MasterField, string>> = {};
  for (const c of campos) {
    if (c === 'name') row.name = draft.name.trim();
    else if (c === 'category') row.category_id = draft.category;
    else if (c === 'unit') row.default_unit_id = draft.unit;
    else if (c === 'group') row.owner_group_id = draft.group || null;
    else if (c === 'isActive') row.is_active = draft.isActive;
    else if (c === 'description') row.description = draft.description.trim() || null;
    else if (c === 'iva') {
      const iva = parseIvaRate(draft.iva);
      if (iva === null) errors.iva = `«${draft.iva}» no es un IVA válido (0 %, 5 % o 19 %).`;
      else row.iva_rate = iva;
    }
  }
  return { row, errors: { ...validateMasterRow(row), ...errors } };
}

export function buildMasterBatch(
  originals: Map<string, MasterDraft>,
  drafts: MasterDraft[]
): { rows: MasterBatchRow[]; errors: MasterErrors } {
  const rows: MasterBatchRow[] = [];
  const errors: MasterErrors = {};
  for (const d of drafts) {
    const o = originals.get(d.id);
    if (!o) continue;
    const r = masterRowFromDraft(o, d);
    if (Object.keys(r.errors).length > 0) errors[d.id] = r.errors;
    if (r.row) rows.push(r.row);
  }
  return { rows, errors };
}

export type PastedMaster = { ok: true; value: string | boolean } | { ok: false; error: string };

/**
 * Una celda escrita o pegada. Las listas se buscan sin tildes ni mayúsculas:
 * la categoría por «Madre › Sub» (también con «>») o por la subcategoría si es
 * única; la unidad por abreviatura o nombre; el grupo por nombre o «Público».
 */
export function masterValueFromPaste(field: MasterField, texto: string, opts: MasterOptions): PastedMaster {
  const limpio = texto.trim();
  const clave = normalizeText(limpio).replace(/\s*[›>]\s*/g, ' > ');

  switch (field) {
    case 'name':
    case 'description':
      return { ok: true, value: limpio };
    case 'isActive': {
      const v = parsePastedBoolean(limpio);
      return v === null ? { ok: false, error: `«${limpio}» no es Sí ni No.` } : { ok: true, value: v };
    }
    case 'iva': {
      const v = parseIvaRate(limpio);
      return v === null ? { ok: false, error: `«${limpio}» no es un IVA válido (0 %, 5 % o 19 %).` } : { ok: true, value: String(v) };
    }
    case 'category': {
      const porId = opts.categories.find((c) => c.id === limpio);
      if (porId) return { ok: true, value: porId.id };
      const porRuta = opts.categories.find((c) => normalizeText(c.label).replace(/\s*[›>]\s*/g, ' > ') === clave);
      if (porRuta) return { ok: true, value: porRuta.id };
      const porNombre = opts.categories.filter((c) => normalizeText(c.name) === clave);
      if (porNombre.length === 1) return { ok: true, value: porNombre[0].id };
      if (porNombre.length > 1) return { ok: false, error: `Hay varias «${limpio}»: escríbela como «Categoría › ${limpio}».` };
      return { ok: false, error: `No hay una subcategoría activa «${limpio}».` };
    }
    case 'unit': {
      const u =
        opts.units.find((x) => x.id === limpio) ??
        opts.units.find((x) => normalizeText(x.abbreviation) === clave) ??
        opts.units.find((x) => normalizeText(x.name) === clave);
      return u ? { ok: true, value: u.id } : { ok: false, error: `No hay una unidad «${limpio}».` };
    }
    case 'group': {
      if (!clave || clave === 'publico' || clave === 'ninguno') return { ok: true, value: '' };
      const g = opts.groups.find((x) => x.id === limpio) ?? opts.groups.find((x) => normalizeText(x.name) === clave);
      return g ? { ok: true, value: g.id } : { ok: false, error: `No hay un grupo «${limpio}».` };
    }
  }
}

/** Lee el cuerpo del guardado sin confiar en él. */
export function parseMasterBatchBody(body: unknown): { rows: MasterBatchRow[] } | { error: string } {
  const lista = (body as { rows?: unknown })?.rows;
  if (!Array.isArray(lista) || lista.length === 0) return { error: 'No hay cambios para guardar.' };
  if (lista.length > MAX_MASTER_BATCH) return { error: `Se pueden guardar hasta ${MAX_MASTER_BATCH} productos a la vez.` };

  const rows: MasterBatchRow[] = [];
  const vistos = new Set<string>();
  const texto = (v: unknown) => typeof v === 'string';
  for (const r of lista as Record<string, unknown>[]) {
    if (!r || typeof r.id !== 'string' || vistos.has(r.id)) return { error: 'Hay una fila sin id o repetida.' };
    vistos.add(r.id);
    const row: MasterBatchRow = { id: r.id };
    if (r.name !== undefined) {
      if (!texto(r.name)) return { error: 'Nombre inválido.' };
      row.name = (r.name as string).trim();
    }
    if (r.category_id !== undefined) {
      if (!texto(r.category_id)) return { error: 'Categoría inválida.' };
      row.category_id = r.category_id as string;
    }
    if (r.default_unit_id !== undefined) {
      if (!texto(r.default_unit_id)) return { error: 'Unidad inválida.' };
      row.default_unit_id = r.default_unit_id as string;
    }
    if (r.iva_rate !== undefined) {
      if (typeof r.iva_rate !== 'number') return { error: 'IVA inválido.' };
      row.iva_rate = r.iva_rate;
    }
    if (r.owner_group_id !== undefined) {
      if (r.owner_group_id !== null && !texto(r.owner_group_id)) return { error: 'Grupo inválido.' };
      row.owner_group_id = (r.owner_group_id as string | null) || null;
    }
    if (r.is_active !== undefined) {
      if (typeof r.is_active !== 'boolean') return { error: 'Activo inválido.' };
      row.is_active = r.is_active;
    }
    if (r.description !== undefined) {
      if (r.description !== null && !texto(r.description)) return { error: 'Descripción inválida.' };
      row.description = (r.description as string | null)?.trim() || null;
    }
    rows.push(row);
  }
  return { rows };
}
