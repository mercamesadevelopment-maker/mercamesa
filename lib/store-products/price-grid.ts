import { parseNumber } from '@/lib/product-import/parse-number';
import { parsePastedBoolean } from '@/lib/utils/pasted-cells';
import { normalizeText } from '@/lib/utils/text';
import { masterValueFromPaste } from '@/lib/catalog/master-grid';

/**
 * La tabla de productos del tendero, que se edita como una hoja de cálculo:
 * precio, precio mayorista, mínimo mayorista, stock y si está publicado.
 *
 * Funciones puras: las usa la tabla (resaltar y avisar mientras se escribe) y
 * la ruta que guarda (`save-price-batch.ts`), que no confía en el navegador.
 */

export type PriceField = 'category' | 'unit' | 'price' | 'wsPrice' | 'wsMin' | 'stock' | 'isActive';

/** Los campos editables, en el orden de las columnas. */
export const PRICE_FIELDS: PriceField[] = ['unit', 'price', 'wsPrice', 'wsMin', 'stock', 'isActive'];

/**
 * Con la categoría (solo el admin, en Inventarios consolidados). La categoría
 * es del producto en el catálogo maestro: se guarda aparte, en el catálogo.
 */
export const PRICE_FIELDS_WITH_CATEGORY: PriceField[] = ['category', ...PRICE_FIELDS];

/** Una categoría elegible (subcategoría, o madre sin subcategorías), como «Madre › Sub». */
export interface CategoryOption {
  id: string;
  name: string;
  label: string;
}

/** Una unidad de medida, para la lista y para leer lo pegado. */
export interface UnitOption {
  id: string;
  name: string;
  abbreviation: string;
}

/** Los valores guardados de un producto. */
export interface PriceValues {
  /** La categoría del producto en el catálogo (solo se edita en el admin). */
  categoryId?: string | null;
  /** `store_products.unit_id`. */
  unitId: string | null;
  price: number;
  wsPrice: number | null;
  wsMin: number | null;
  stock: number;
  isActive: boolean;
}

/** Una fila mientras se edita: los números van como texto, tal cual se escriben. */
export interface PriceDraft {
  id: string;
  /** Id de la categoría del catálogo, o vacío. */
  category: string;
  /** Id de la unidad, o vacío. */
  unit: string;
  price: string;
  wsPrice: string;
  wsMin: string;
  stock: string;
  isActive: boolean;
}

/** Lo que se manda a guardar: solo los campos que cambiaron. */
export interface PriceBatchRow {
  id: string;
  /** No va a la ruta de la tienda: se guarda en el catálogo (ver `splitCategoryChanges`). */
  category_id?: string;
  unit_id?: string;
  price_per_unit?: number;
  wholesale_price?: number | null;
  wholesale_min_qty?: number | null;
  stock?: number;
  is_active?: boolean;
}

export type PriceErrors = Record<string, Partial<Record<PriceField, string>>>;

/**
 * Un producto publicado necesita precio. Los que la base asigna solos a las
 * tiendas de un grupo llegan con precio 0 y sin publicar: hay que ponerles
 * precio antes de publicarlos. La base lo exige también (`check` en
 * `store_products`); esto es para decirlo en la celda y no con su error.
 */
export const UNPRICED_PUBLISH_MESSAGE = 'Ponle precio antes de publicarlo.';

export function publishesWithoutPrice(isActive: boolean, price: number): boolean {
  return isActive && Number.isFinite(price) && price <= 0;
}

/** Tope de filas por guardado. */
export const MAX_BATCH_ROWS = 2000;

const texto = (n: number | null) => (n === null ? '' : String(n));

export function draftFromValues(id: string, v: PriceValues): PriceDraft {
  return {
    id,
    category: v.categoryId ?? '',
    unit: v.unitId ?? '',
    price: texto(v.price),
    wsPrice: texto(v.wsPrice),
    wsMin: texto(v.wsMin),
    stock: texto(v.stock),
    isActive: v.isActive,
  };
}

/**
 * Qué campos difieren de lo guardado. Se compara el texto: si no se tocó,
 * sigue siendo el que salió de `draftFromValues`.
 */
export function changedFields(original: PriceDraft | undefined, draft: PriceDraft): PriceField[] {
  if (!original) return [];
  return PRICE_FIELDS_WITH_CATEGORY.filter((f) => original[f] !== draft[f]);
}

/** El texto que deja `String(n)`: lo que guarda el borrador después de leer una celda. */
const NUMERO_NORMALIZADO = /^-?\d+(\.\d+)?$/;

/**
 * Un número del borrador: vacío es `null`; lo que no se entiende, `NaN`.
 *
 * Lo escrito o pegado ya llega normalizado (`priceValueFromPaste` deja «1.200»
 * como «1200», y «2,5» como «2.5»), así que ese formato se lee tal cual. Volver
 * a pasarlo por `parseNumber` convertía un decimal de tres cifras, como 2,125
 * kg, en 2125: para el formato colombiano «2.125» es dos mil ciento veinticinco.
 */
function leerNumero(valor: string): number | null {
  const t = valor.trim();
  if (t === '') return null;
  if (NUMERO_NORMALIZADO.test(t)) return Number(t);
  return parseNumber(t) ?? Number.NaN;
}

/**
 * Las reglas de una fila ya en números, contra lo que hay guardado (`actual`):
 * un mayorista que se queda igual se compara con el precio nuevo.
 */
export function validateRow(row: PriceBatchRow, actual: PriceValues): Partial<Record<PriceField, string>> {
  const errores: Partial<Record<PriceField, string>> = {};
  const precio = row.price_per_unit ?? actual.price;
  const mayorista = row.wholesale_price !== undefined ? row.wholesale_price : actual.wsPrice;

  if (row.price_per_unit !== undefined && !(Number.isFinite(row.price_per_unit) && row.price_per_unit > 0)) {
    errores.price = 'El precio tiene que ser mayor que 0.';
  }
  if (row.wholesale_price !== undefined && row.wholesale_price !== null && !(Number.isFinite(row.wholesale_price) && row.wholesale_price > 0)) {
    errores.wsPrice = 'El precio mayorista tiene que ser mayor que 0, o quedar vacío.';
  } else if (mayorista !== null && Number.isFinite(precio) && precio > 0 && mayorista > precio) {
    // Con un precio inválido ya hay error en el precio: no se repite acá.
    errores.wsPrice = 'El precio mayorista no puede ser mayor que el precio.';
  }
  if (row.wholesale_min_qty !== undefined && row.wholesale_min_qty !== null && !(Number.isInteger(row.wholesale_min_qty) && row.wholesale_min_qty >= 1)) {
    errores.wsMin = 'El mínimo mayorista es un número entero de 1 o más, o vacío.';
  }
  if (row.stock !== undefined && !(Number.isFinite(row.stock) && row.stock >= 0)) {
    errores.stock = 'El stock tiene que ser 0 o más.';
  }
  // Con un precio nuevo inválido ya hay error en el precio: no se repite acá.
  if (!errores.price && publishesWithoutPrice(row.is_active ?? actual.isActive, precio)) {
    errores.isActive = UNPRICED_PUBLISH_MESSAGE;
  }
  return errores;
}

/**
 * Convierte una fila editada en lo que se guarda (solo lo cambiado) y dice qué
 * celdas están mal. Una fila sin cambios no se valida: lo guardado no bloquea.
 */
export function rowFromDraft(
  original: PriceDraft,
  draft: PriceDraft,
  actual: PriceValues
): { row: PriceBatchRow | null; errors: Partial<Record<PriceField, string>> } {
  const campos = changedFields(original, draft);
  if (campos.length === 0) return { row: null, errors: {} };

  const row: PriceBatchRow = { id: draft.id };
  const errors: Partial<Record<PriceField, string>> = {};
  const noEsNumero = (f: PriceField) => (errors[f] = `«${draft[f]}» no es un número.`);

  for (const campo of campos) {
    if (campo === 'isActive') {
      row.is_active = draft.isActive;
      continue;
    }
    if (campo === 'category') {
      if (!draft.category) errors.category = 'Elige una subcategoría.';
      else row.category_id = draft.category;
      continue;
    }
    if (campo === 'unit') {
      if (!draft.unit) errors.unit = 'Elige una unidad de medida.';
      else row.unit_id = draft.unit;
      continue;
    }
    const n = leerNumero(draft[campo]);
    if (Number.isNaN(n)) {
      noEsNumero(campo);
      continue;
    }
    if (campo === 'price') {
      if (n === null) errors.price = 'El precio no puede quedar vacío.';
      else row.price_per_unit = n;
    } else if (campo === 'stock') {
      if (n === null) errors.stock = 'El stock no puede quedar vacío; escribe 0 si no hay.';
      else row.stock = n;
    } else if (campo === 'wsPrice') {
      row.wholesale_price = n;
    } else {
      row.wholesale_min_qty = n;
    }
  }

  return { row, errors: { ...validateRow(row, actual), ...errors } };
}

/** Todas las filas cambiadas, y los errores de cada una. */
export function buildPriceBatch(
  originals: Map<string, PriceDraft>,
  drafts: PriceDraft[],
  actuales: Map<string, PriceValues>
): { rows: PriceBatchRow[]; errors: PriceErrors } {
  const rows: PriceBatchRow[] = [];
  const errors: PriceErrors = {};
  for (const d of drafts) {
    const original = originals.get(d.id);
    const actual = actuales.get(d.id);
    if (!original || !actual) continue;
    const r = rowFromDraft(original, d, actual);
    if (Object.keys(r.errors).length > 0) errors[d.id] = r.errors;
    if (r.row) rows.push(r.row);
  }
  return { rows, errors };
}

export function countPriceErrors(errores: PriceErrors): number {
  return Object.values(errores).reduce((n, porCampo) => n + Object.keys(porCampo).length, 0);
}

export type PastedPrice = { ok: true; value: string | boolean } | { ok: false; error: string };

/**
 * Una celda pegada desde Excel. Los números se guardan ya normalizados
 * («$ 1.200» queda «1200»), para que la tabla los muestre como se van a guardar.
 */
export function priceValueFromPaste(
  field: PriceField,
  texto: string,
  units: UnitOption[] = [],
  categories: CategoryOption[] = []
): PastedPrice {
  const limpio = texto.trim();
  if (field === 'category') {
    const r = masterValueFromPaste('category', limpio, { categories, units: [], groups: [] });
    return r;
  }
  if (field === 'unit') {
    const unidad = findUnit(limpio, units);
    return unidad ? { ok: true, value: unidad.id } : { ok: false, error: `No hay una unidad «${limpio}».` };
  }
  if (field === 'isActive') {
    const v = parsePastedBoolean(limpio);
    return v === null ? { ok: false, error: `«${limpio}» no es Sí ni No.` } : { ok: true, value: v };
  }
  if (limpio === '') return { ok: true, value: '' };
  const n = parseNumber(limpio);
  return n === null ? { ok: false, error: `«${limpio}» no es un número.` } : { ok: true, value: String(n) };
}

/**
 * Separa los cambios de categoría (van al catálogo maestro, por producto del
 * catálogo) del resto (van a la tienda). Dos filas del mismo producto en
 * tiendas distintas no pueden pedir categorías distintas: es una sola.
 */
export function splitCategoryChanges(
  rows: PriceBatchRow[],
  catalogIdOf: (storeProductId: string) => string | undefined
): {
  storeRows: PriceBatchRow[];
  catalogRows: { id: string; category_id: string }[];
  /** Para cada producto del catálogo, las filas de tienda que pidieron el cambio. */
  rowsByCatalog: Map<string, string[]>;
  errors: PriceErrors;
} {
  const storeRows: PriceBatchRow[] = [];
  const pedidas = new Map<string, Set<string>>();
  const rowsByCatalog = new Map<string, string[]>();
  for (const r of rows) {
    const { category_id, ...resto } = r;
    if (category_id !== undefined) {
      const cat = catalogIdOf(r.id);
      if (cat) {
        (pedidas.get(cat) ?? pedidas.set(cat, new Set()).get(cat)!).add(category_id);
        (rowsByCatalog.get(cat) ?? rowsByCatalog.set(cat, []).get(cat)!).push(r.id);
      }
    }
    if (Object.keys(resto).length > 1) storeRows.push(resto);
  }
  const errors: PriceErrors = {};
  const catalogRows: { id: string; category_id: string }[] = [];
  for (const [cat, valores] of pedidas) {
    if (valores.size > 1) {
      for (const id of rowsByCatalog.get(cat) ?? []) {
        errors[id] = { category: 'Este producto está en varias filas con categorías distintas: es una sola para todas las tiendas.' };
      }
    } else catalogRows.push({ id: cat, category_id: [...valores][0] });
  }
  return { storeRows, catalogRows, rowsByCatalog, errors };
}

/** Una unidad por su id, su abreviatura o su nombre, sin tildes ni mayúsculas. */
export function findUnit(texto: string, units: UnitOption[]): UnitOption | null {
  const t = normalizeText(texto.trim());
  if (!t) return null;
  return (
    units.find((u) => u.id === texto.trim()) ??
    units.find((u) => normalizeText(u.abbreviation) === t) ??
    units.find((u) => normalizeText(u.name) === t) ??
    null
  );
}

/** Lee el cuerpo del guardado sin confiar en él: forma, tipos y tope. */
export function parsePriceBatchBody(body: unknown): { rows: PriceBatchRow[] } | { error: string } {
  const lista = (body as { rows?: unknown })?.rows;
  if (!Array.isArray(lista) || lista.length === 0) return { error: 'No hay cambios para guardar.' };
  if (lista.length > MAX_BATCH_ROWS) return { error: `Se pueden guardar hasta ${MAX_BATCH_ROWS} productos a la vez.` };

  const numOrNull = (v: unknown) => v === null || typeof v === 'number';
  const rows: PriceBatchRow[] = [];
  const vistos = new Set<string>();
  for (const r of lista as Record<string, unknown>[]) {
    if (!r || typeof r.id !== 'string' || vistos.has(r.id)) return { error: 'Hay una fila sin id o repetida.' };
    vistos.add(r.id);
    const row: PriceBatchRow = { id: r.id };
    if (r.unit_id !== undefined) {
      if (typeof r.unit_id !== 'string' || !r.unit_id) return { error: 'Unidad inválida.' };
      row.unit_id = r.unit_id;
    }
    if (r.price_per_unit !== undefined) {
      if (typeof r.price_per_unit !== 'number') return { error: 'Precio inválido.' };
      row.price_per_unit = r.price_per_unit;
    }
    if (r.wholesale_price !== undefined) {
      if (!numOrNull(r.wholesale_price)) return { error: 'Precio mayorista inválido.' };
      row.wholesale_price = r.wholesale_price as number | null;
    }
    if (r.wholesale_min_qty !== undefined) {
      if (!numOrNull(r.wholesale_min_qty)) return { error: 'Mínimo mayorista inválido.' };
      row.wholesale_min_qty = r.wholesale_min_qty as number | null;
    }
    if (r.stock !== undefined) {
      if (typeof r.stock !== 'number') return { error: 'Stock inválido.' };
      row.stock = r.stock;
    }
    if (r.is_active !== undefined) {
      if (typeof r.is_active !== 'boolean') return { error: 'Publicado inválido.' };
      row.is_active = r.is_active;
    }
    rows.push(row);
  }
  return { rows };
}
