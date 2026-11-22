import { normalizeText } from '@/lib/utils/text';
import {
  draftFromValues,
  priceValueFromPaste,
  PRICE_FIELDS,
  type PriceField,
  type PriceValues,
  type UnitOption,
} from './price-grid';

/**
 * Importar el Excel de «Mis productos»: qué cambió respecto a lo guardado.
 *
 * No escribe nada. Lo que sale de acá se vuelca en la tabla como si el tendero
 * lo hubiera pegado, y se guarda con el mismo «Guardar» (`savePriceBatch`), con
 * las mismas reglas. Así no hay una segunda forma de escribir precios.
 *
 * Funciones puras, con pruebas en `price-import.test.ts`. El archivo lo arma y
 * lo lee `price-workbook.ts`.
 */

/** Las columnas del archivo. Las de `PRICE_FIELDS` se escriben; las demás son referencia. */
export type SheetColumn = 'id' | 'code' | 'name' | 'store' | 'category' | 'iva' | Exclude<PriceField, 'category'>;

export const SHEET_HEADERS: Record<SheetColumn, string> = {
  id: 'ID',
  code: 'Código',
  name: 'Producto',
  store: 'Tienda',
  category: 'Categoría',
  unit: 'Unidad',
  price: 'Precio minorista',
  wsPrice: 'Precio mayorista',
  wsMin: 'Mín. mayorista',
  stock: 'Stock',
  iva: 'IVA',
  isActive: 'Publicado',
};

/** Otros nombres que se aceptan al leer, por si alguien renombra una columna. */
const ALIASES: Record<string, SheetColumn> = {
  'codigo del producto': 'code',
  'nombre': 'name',
  'unidad de medida': 'unit',
  'precio': 'price',
  'precio al detal': 'price',
  'minimo mayorista': 'wsMin',
  'min mayorista': 'wsMin',
  'cantidad minima mayorista': 'wsMin',
  'activo': 'isActive',
  'publicada': 'isActive',
};

/** Lo que el tendero puede cambiar desde el archivo. */
export const IMPORT_FIELDS = PRICE_FIELDS.filter((f) => f !== 'category') as Exclude<PriceField, 'category'>[];

/** Lo que se ve pero no se cambia: es del catálogo maestro. */
const REFERENCE_COLUMNS = ['name', 'category', 'iva'] as const;
type ReferenceColumn = (typeof REFERENCE_COLUMNS)[number];

export const REFERENCE_LABELS: Record<ReferenceColumn, string> = {
  name: 'Producto',
  category: 'Categoría',
  iva: 'IVA',
};

/** El valor de una celda tal como lo dejó Excel: un número sigue siendo número. */
export type CellValue = string | number | boolean;

export interface SheetRow {
  /** Número de la fila en Excel (el encabezado es la 1). */
  row: number;
  cells: Partial<Record<SheetColumn, CellValue>>;
}

/** Un producto de la tabla, lo mínimo para comparar. `PriceGridRow` lo cumple. */
export interface ImportTarget {
  id: string;
  code: string;
  name: string;
  categoryLabel?: string;
  ivaRate: number;
  values: PriceValues;
}

export interface ImportChange {
  id: string;
  field: PriceField;
  value: string | boolean;
}

export interface ImportCellError {
  id: string;
  field: PriceField;
  error: string;
}

export interface ImportPlan {
  changes: ImportChange[];
  errors: ImportCellError[];
  /** Productos con al menos un cambio. */
  productsTouched: number;
  /** Filas del archivo que no son de ningún producto de la tabla. */
  notFound: number[];
  /** Filas que apuntan a un producto que ya vino en otra fila: se usa la primera. */
  duplicated: number[];
  /** Columnas de referencia que alguien cambió: no se aplican. */
  ignored: Partial<Record<ReferenceColumn, number>>;
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

function listaFilas(filas: number[]): string {
  const muestra = filas.slice(0, 8).join(', ');
  return filas.length > 8 ? `${muestra} y ${filas.length - 8} más` : muestra;
}

/** Lo que se le dice al tendero después de importar. */
export function summarizeImport(plan: ImportPlan): { title: string; notes: string[] } {
  const title =
    plan.productsTouched === 0
      ? plan.errors.length > 0
        ? 'El archivo no trae cambios que se puedan aplicar.'
        : 'El archivo no trae cambios respecto a lo que ya tienes.'
      : `Se cargaron ${plural(plan.changes.length, 'cambio', 'cambios')} en ${plural(plan.productsTouched, 'producto', 'productos')}. Revísalos en la tabla y dale «Guardar»: hasta entonces no cambia nada.`;

  const notes: string[] = [];
  if (plan.errors.length > 0) {
    notes.push(`${plural(plan.errors.length, 'celda no se pudo leer', 'celdas no se pudieron leer')}: quedaron marcadas en rojo para que las corrijas.`);
  }
  const ignoradas = (Object.keys(plan.ignored) as ReferenceColumn[]).map((c) => `«${REFERENCE_LABELS[c]}»`);
  if (ignoradas.length > 0) {
    notes.push(`Cambiaste ${ignoradas.join(', ')}: son del catálogo de MercaMesa y no se aplicaron.`);
  }
  if (plan.notFound.length > 0) {
    notes.push(
      plan.notFound.length === 1
        ? `La fila ${plan.notFound[0]} no es de tus productos y se ignoró.`
        : `Las filas ${listaFilas(plan.notFound)} no son de tus productos y se ignoraron.`
    );
  }
  if (plan.duplicated.length > 0) {
    notes.push(
      plan.duplicated.length === 1
        ? `La fila ${plan.duplicated[0]} repite un producto que ya venía antes: se usó la primera.`
        : `Las filas ${listaFilas(plan.duplicated)} repiten un producto que ya venía antes: se usó la primera.`
    );
  }
  return { title, notes };
}

function normalizeHeader(value: string): string {
  return normalizeText(value).replace(/[.:]/g, '').replace(/\s+/g, ' ').trim();
}

const COLUMN_BY_HEADER = new Map<string, SheetColumn>([
  ...Object.entries(ALIASES).map(([h, c]) => [normalizeHeader(h), c] as const),
  ...(Object.entries(SHEET_HEADERS) as [SheetColumn, string][]).map(([c, h]) => [normalizeHeader(h), c] as const),
]);

/**
 * Qué columna es cada encabezado. Las que no se reconocen se ignoran (notas
 * propias del tendero); si una se repite, gana la primera.
 */
export function mapHeaders(headers: string[]): Map<number, SheetColumn> {
  const out = new Map<number, SheetColumn>();
  const usadas = new Set<SheetColumn>();
  headers.forEach((h, i) => {
    const col = COLUMN_BY_HEADER.get(normalizeHeader(String(h ?? '')));
    if (col && !usadas.has(col)) {
      out.set(i, col);
      usadas.add(col);
    }
  });
  return out;
}

/** El IVA como se escribe en el archivo: «19 %». */
export function ivaText(rate: number): string {
  return `${Math.round(rate * 100)} %`;
}

const comoTexto = (v: CellValue | undefined) => (v === undefined ? '' : String(v).trim());

/**
 * Una celda del archivo como valor del borrador de la tabla.
 *
 * Un número que Excel guardó como número se toma tal cual: pasarlo por el
 * lector de texto convertiría 2,125 kg (que Excel guarda 2.125) en 2.125 kg con
 * punto de miles, es decir, dos mil ciento veinticinco.
 */
function leerCelda(field: PriceField, v: CellValue, units: UnitOption[]) {
  if (typeof v === 'number' && field !== 'unit' && field !== 'isActive') {
    return Number.isFinite(v) ? { ok: true as const, value: String(v) } : { ok: false as const, error: 'No es un número.' };
  }
  if (typeof v === 'boolean' && field === 'isActive') return { ok: true as const, value: v };
  return priceValueFromPaste(field, String(v), units);
}

/**
 * Compara las filas del archivo con los productos de la tabla y devuelve lo que
 * cambió, celda por celda. Un producto se encuentra por su ID (columna oculta)
 * y, si la borraron, por el código, que no se repite dentro de una tienda.
 */
export function planPriceImport(rows: SheetRow[], targets: ImportTarget[], units: UnitOption[]): ImportPlan {
  const porId = new Map(targets.map((t) => [t.id, t]));
  // El código solo sirve de llave si es único entre los productos de la tabla:
  // con varias tiendas, dos pueden tener el mismo.
  const conteoCodigo = new Map<string, number>();
  for (const t of targets) if (t.code) conteoCodigo.set(t.code.toUpperCase(), (conteoCodigo.get(t.code.toUpperCase()) ?? 0) + 1);
  const porCodigo = new Map(
    targets.filter((t) => t.code && conteoCodigo.get(t.code.toUpperCase()) === 1).map((t) => [t.code.toUpperCase(), t])
  );

  const plan: ImportPlan = { changes: [], errors: [], productsTouched: 0, notFound: [], duplicated: [], ignored: {} };
  const vistos = new Set<string>();
  const tocados = new Set<string>();

  for (const fila of rows) {
    const id = comoTexto(fila.cells.id);
    const codigo = comoTexto(fila.cells.code).toUpperCase();
    const algoEscrito = Object.values(fila.cells).some((v) => comoTexto(v) !== '');
    if (!algoEscrito) continue;

    const target = (id && porId.get(id)) || (codigo ? porCodigo.get(codigo) : undefined);
    if (!target) {
      plan.notFound.push(fila.row);
      continue;
    }
    if (vistos.has(target.id)) {
      plan.duplicated.push(fila.row);
      continue;
    }
    vistos.add(target.id);

    // Lo del catálogo maestro: se avisa si lo cambiaron, no se aplica.
    const referencia: Record<ReferenceColumn, string> = {
      name: target.name,
      category: target.categoryLabel ?? '',
      iva: ivaText(target.ivaRate),
    };
    for (const col of REFERENCE_COLUMNS) {
      if (!(col in fila.cells)) continue;
      if (normalizeText(comoTexto(fila.cells[col])) !== normalizeText(referencia[col])) {
        plan.ignored[col] = (plan.ignored[col] ?? 0) + 1;
      }
    }

    const original = draftFromValues(target.id, target.values);
    for (const field of IMPORT_FIELDS) {
      // Una columna que no viene en el archivo no se toca.
      if (!(field in fila.cells)) continue;
      // Un producto no se queda sin unidad: la celda vacía no la borra.
      if (field === 'unit' && comoTexto(fila.cells.unit) === '') continue;
      const r = leerCelda(field, fila.cells[field] ?? '', units);
      if ('error' in r) {
        plan.errors.push({ id: target.id, field, error: r.error });
        continue;
      }
      if (r.value !== original[field]) {
        plan.changes.push({ id: target.id, field, value: r.value });
        tocados.add(target.id);
      }
    }
  }

  plan.productsTouched = tocados.size;
  return plan;
}
