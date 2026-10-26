/**
 * Los filtros de Contabilidad: cliente, tienda, plaza y mes o año.
 *
 * Los meses se cuentan en la hora de Colombia (UTC-5, sin horario de verano):
 * un pago de las 8 p. m. del 31 de octubre es de octubre aunque en UTC ya sea
 * noviembre.
 */

export interface AccountingFilters {
  /** Nombre, documento o correo del cliente. */
  buyerQuery: string | null;
  storeId: string | null;
  marketplaceId: string | null;
  year: number | null;
  /** 1 a 12. Sin año no se usa. */
  month: number | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOGOTA_OFFSET_HOURS = 5;

export function parseAccountingFilters(params: URLSearchParams): AccountingFilters {
  const year = toInt(params.get('year'), 2020, 2100);
  return {
    buyerQuery: params.get('buyer')?.trim().slice(0, 80) || null,
    storeId: uuidOrNull(params.get('store_id')),
    marketplaceId: uuidOrNull(params.get('marketplace_id')),
    year,
    month: year ? toInt(params.get('month'), 1, 12) : null,
  };
}

/** Si los filtros restringen por persona o lugar (no solo por fecha). */
export function hasScopeFilters(f: AccountingFilters): boolean {
  return Boolean(f.buyerQuery || f.storeId || f.marketplaceId);
}

/**
 * El periodo del filtro en UTC, como `[desde, hasta)`. `null` si no hay año.
 * `withZone: false` es para columnas `timestamp` sin zona que guardan UTC
 * (como `payments.created_at`): ahí no va la `Z`.
 */
export function periodRange(
  f: Pick<AccountingFilters, 'year' | 'month'>,
  { withZone = true } = {}
): { from: string; to: string } | null {
  if (!f.year) return null;
  const startMonth = f.month ? f.month - 1 : 0;
  const endMonth = f.month ? f.month : 12;
  const from = new Date(Date.UTC(f.year, startMonth, 1, BOGOTA_OFFSET_HOURS));
  const to = new Date(Date.UTC(f.year, endMonth, 1, BOGOTA_OFFSET_HOURS));
  const fmt = (d: Date) => (withZone ? d.toISOString() : d.toISOString().slice(0, 19));
  return { from: fmt(from), to: fmt(to) };
}

/** El periodo como fechas de calendario `[desde, hasta)`, para columnas `date`. */
export function periodDates(f: Pick<AccountingFilters, 'year' | 'month'>): { from: string; to: string } | null {
  if (!f.year) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (!f.month) return { from: `${f.year}-01-01`, to: `${f.year + 1}-01-01` };
  const next = f.month === 12 ? `${f.year + 1}-01-01` : `${f.year}-${pad(f.month + 1)}-01`;
  return { from: `${f.year}-${pad(f.month)}-01`, to: next };
}

/** Texto seguro para un `.or(...)` de PostgREST: sin comas, paréntesis ni comodines propios. */
export function sanitizeSearch(q: string): string {
  return q.replace(/[,()*%\\]/g, ' ').replace(/\s+/g, ' ').trim();
}

function toInt(value: string | null, min: number, max: number): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const n = Number(value);
  return n >= min && n <= max ? n : null;
}

function uuidOrNull(value: string | null): string | null {
  return value && UUID.test(value) ? value : null;
}
