import { normalizeText } from '@/lib/utils/text';
import { uniqueSlug } from '@/lib/catalog-import/slug';

/**
 * Edición masiva de las categorías del catálogo, como en una hoja de cálculo:
 * qué cambió, qué está mal y cómo se interpreta lo que se pega desde Excel.
 *
 * Funciones puras: las usan la pestaña (para resaltar y avisar mientras se
 * escribe) y la ruta que guarda (para no confiar en el navegador).
 *
 * Las categorías tienen dos niveles: una madre es siempre una categoría raíz.
 * Es lo que asume la plantilla del catálogo («Padre > Hijo») y lo que hay en
 * producción. La base lo vuelve a comprobar al guardar.
 */

/** Una fila de la tabla. Los valores van como se escriben: el orden es texto hasta validarlo. */
export interface CategoryDraft {
  /** El id, o un id temporal (`nueva-…`) si la fila todavía no está guardada. */
  key: string;
  id: string | null;
  /** Solo las guardadas: el slug no se edita. */
  slug: string | null;
  name: string;
  /** `key` de la madre, o vacío si es raíz. */
  parentKey: string;
  description: string;
  sortOrder: string;
  isActive: boolean;
}

export type CategoryField = 'name' | 'parentKey' | 'description' | 'sortOrder' | 'isActive';

/** Errores por fila (`key`) y columna. */
export type CategoryErrors = Record<string, Partial<Record<CategoryField, string>>>;

/** Lo que se manda a guardar: solo las filas nuevas o cambiadas. */
export interface CategoryBatchRow {
  key: string;
  id: string | null;
  /** Solo las nuevas; las guardadas conservan el suyo. */
  slug: string | null;
  name: string;
  /** Id de una guardada o `key` de una nueva del mismo lote; `null` = raíz. */
  parent_key: string | null;
  description: string | null;
  sort_order: number;
  is_active: boolean;
}

export const CATEGORY_FIELDS: CategoryField[] = ['name', 'parentKey', 'description', 'sortOrder', 'isActive'];

const NEW_PREFIX = 'nueva-';

export function newCategoryKey(n: number): string {
  return `${NEW_PREFIX}${n}`;
}

export function isNewKey(key: string): boolean {
  return key.startsWith(NEW_PREFIX);
}

/** Una categoría guardada, como fila de la tabla. */
export function draftFromCategory(c: {
  id: string;
  slug: string;
  name: string;
  parent_id: string | null;
  description: string | null;
  sort_order: number | null;
  is_active: boolean;
}): CategoryDraft {
  return {
    key: c.id,
    id: c.id,
    slug: c.slug,
    name: c.name,
    parentKey: c.parent_id ?? '',
    description: c.description ?? '',
    sortOrder: String(c.sort_order ?? 0),
    isActive: c.is_active,
  };
}

export function emptyDraft(key: string): CategoryDraft {
  return { key, id: null, slug: null, name: '', parentKey: '', description: '', sortOrder: '0', isActive: true };
}

/** Una fila nueva en la que nadie escribió nada: no cuenta como cambio ni como error. */
export function isBlankDraft(d: CategoryDraft): boolean {
  return d.id === null && !d.name.trim() && !d.parentKey && !d.description.trim();
}

/** Las columnas de una fila que difieren de lo guardado. Una fila nueva tiene todas. */
export function changedFields(original: CategoryDraft | undefined, draft: CategoryDraft): CategoryField[] {
  if (!original) return isBlankDraft(draft) ? [] : CATEGORY_FIELDS;
  return CATEGORY_FIELDS.filter((f) => {
    if (f === 'name' || f === 'description' || f === 'sortOrder') return original[f].trim() !== draft[f].trim();
    return original[f] !== draft[f];
  });
}

/**
 * Las reglas, fila por fila. Las filas nuevas vacías se ignoran.
 *
 * Con `originals`, un choque de niveles se marca solo en la fila que se movió:
 * si a una categoría con hijas le pusieron madre, el error va en ella; si a una
 * fila le eligieron como madre una subcategoría, va en esa fila. Sin
 * `originals`, en las dos.
 */
export function validateCategories(drafts: CategoryDraft[], originals?: CategoryDraft[]): CategoryErrors {
  const errores: CategoryErrors = {};
  const set = (key: string, field: CategoryField, mensaje: string) => {
    (errores[key] ??= {})[field] = mensaje;
  };

  const vivas = drafts.filter((d) => !isBlankDraft(d));
  const porKey = new Map(vivas.map((d) => [d.key, d]));
  const madreOriginal = originals ? new Map(originals.map((o) => [o.key, o.parentKey])) : null;
  /** Si la madre de la fila cambió respecto a lo guardado (o no se sabe). */
  const semovio = (d: CategoryDraft) => !madreOriginal || madreOriginal.get(d.key) !== d.parentKey;
  const conHijas = new Set(vivas.map((d) => d.parentKey).filter(Boolean));
  const nombres = new Map<string, CategoryDraft>();

  for (const d of vivas) {
    const nombre = d.name.trim();
    if (!nombre) set(d.key, 'name', 'El nombre es obligatorio.');

    if (d.sortOrder.trim() !== '' && !/^-?\d+$/.test(d.sortOrder.trim())) {
      set(d.key, 'sortOrder', 'El orden tiene que ser un número entero.');
    }

    if (d.parentKey) {
      const madre = porKey.get(d.parentKey);
      if (d.parentKey === d.key) set(d.key, 'parentKey', 'Una categoría no puede ser su propia madre.');
      else if (!madre) set(d.key, 'parentKey', 'La categoría madre no existe.');
      else if (madre.parentKey && (semovio(d) || !semovio(madre))) {
        set(d.key, 'parentKey', `«${madre.name.trim()}» es una subcategoría: la madre tiene que ser una categoría raíz.`);
      } else if (conHijas.has(d.key) && semovio(d)) {
        set(d.key, 'parentKey', 'Tiene subcategorías: no puede quedar dentro de otra.');
      }
    }

    // El mismo nombre puede repetirse bajo madres distintas («Hojas»), no bajo la misma.
    if (nombre) {
      const clave = `${d.parentKey}|${normalizeText(nombre).trim()}`;
      const otra = nombres.get(clave);
      if (otra) set(d.key, 'name', `Ya hay una categoría «${otra.name.trim()}» en el mismo lugar.`);
      else nombres.set(clave, d);
    }
  }

  return errores;
}

export function countErrors(errores: CategoryErrors): number {
  return Object.values(errores).reduce((n, porCampo) => n + Object.keys(porCampo).length, 0);
}

/**
 * Las filas a guardar: las nuevas con contenido y las que cambiaron. A las
 * nuevas se les da un slug libre (`takenSlugs` son los que ya existen).
 */
export function buildCategoryBatch(
  originals: CategoryDraft[],
  drafts: CategoryDraft[],
  takenSlugs: Set<string>
): CategoryBatchRow[] {
  const porKey = new Map(originals.map((o) => [o.key, o]));
  const libres = new Set(takenSlugs);

  return drafts
    .filter((d) => changedFields(porKey.get(d.key), d).length > 0)
    .map((d) => ({
      key: d.key,
      id: d.id,
      slug: d.id ? null : uniqueSlug(d.name.trim(), libres),
      name: d.name.trim(),
      parent_key: d.parentKey || null,
      description: d.description.trim() || null,
      sort_order: d.sortOrder.trim() === '' ? 0 : Number(d.sortOrder.trim()),
      is_active: d.isActive,
    }));
}

/**
 * Una fila recibida, como borrador. El servidor arma con esto la tabla completa
 * (lo guardado más lo que llega) para validar con las mismas reglas, sin
 * confiar en el navegador. El slug que venga se ignora: lo pone el servidor.
 */
export function draftFromBatchRow(row: Partial<CategoryBatchRow>): CategoryDraft {
  const id = row.id ? String(row.id) : null;
  return {
    key: String(row.key ?? id ?? ''),
    id,
    slug: null,
    name: String(row.name ?? ''),
    parentKey: row.parent_key ? String(row.parent_key) : '',
    description: String(row.description ?? ''),
    sortOrder: row.sort_order === undefined || row.sort_order === null ? '0' : String(row.sort_order),
    isActive: row.is_active !== false,
  };
}

/**
 * La tabla completa: lo guardado con los cambios encima, y las nuevas al final.
 * Una fila editada conserva el slug guardado.
 */
export function mergeDrafts(originals: CategoryDraft[], cambios: CategoryDraft[]): CategoryDraft[] {
  const porKey = new Map(cambios.map((c) => [c.key, c]));
  const editadas = originals.map((o) => {
    const c = porKey.get(o.key);
    return c ? { ...c, id: o.id, slug: o.slug } : o;
  });
  const nuevas = cambios.filter((c) => !c.id && !originals.some((o) => o.key === c.key));
  return [...editadas, ...nuevas];
}

// ── Pegar desde Excel ───────────────────────────────────────────────────────

/** El texto que Excel pone en el portapapeles: filas por salto de línea, celdas por tabulador. */
export function parsePastedCells(texto: string): string[][] {
  const filas = texto.replace(/\r\n?/g, '\n').split('\n');
  // Excel termina lo copiado con un salto de línea: esa última fila vacía no es dato.
  if (filas.length > 1 && filas[filas.length - 1] === '') filas.pop();
  return filas.map((fila) => fila.split('\t'));
}

const SI = new Set(['si', 'sí', 'x', 'true', 'verdadero', '1', 'activa', 'activo']);
const NO = new Set(['no', 'false', 'falso', '0', 'inactiva', 'inactivo', '']);

export type PastedValue = { ok: true; value: string | boolean } | { ok: false; error: string };

/**
 * Interpreta una celda pegada según su columna. La madre se busca por nombre
 * (sin tildes) entre las categorías raíz de la tabla. Lo que no se entiende no
 * se descarta en silencio: vuelve como error de esa celda.
 */
export function valueFromPaste(field: CategoryField, texto: string, drafts: CategoryDraft[]): PastedValue {
  const limpio = texto.trim();

  if (field === 'isActive') {
    const clave = normalizeText(limpio);
    if (SI.has(clave)) return { ok: true, value: true };
    if (NO.has(clave)) return { ok: true, value: false };
    return { ok: false, error: `«${limpio}» no es Sí ni No.` };
  }

  if (field === 'parentKey') {
    const clave = normalizeText(limpio);
    if (clave === '' || clave === 'ninguna' || clave === 'raiz') return { ok: true, value: '' };
    const candidatas = drafts.filter((d) => !d.parentKey && normalizeText(d.name.trim()) === clave);
    if (candidatas.length === 1) return { ok: true, value: candidatas[0].key };
    if (candidatas.length > 1) return { ok: false, error: `Hay varias categorías raíz llamadas «${limpio}».` };
    return { ok: false, error: `No hay una categoría raíz llamada «${limpio}».` };
  }

  return { ok: true, value: limpio };
}
