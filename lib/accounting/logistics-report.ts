import type { AccountingFilters } from './filters';

/**
 * El reporte de logística de Contabilidad: qué plazas tienen logística y
 * cuántos servicios prestó cada una, en total y por día. Lo pide el convenio
 * con el aliado de logística.
 *
 * Un servicio es un pedido que salió de la bahía y en el que logística
 * intervino (lo cuenta `logistics_services_by_day` en la base). Acá solo se
 * arma el reporte: puro, con pruebas.
 */

export interface LogisticsDay {
  marketplaceId: string;
  day: string;
  services: number;
  partsReceived: number;
  partsDamaged: number;
}

export interface LogisticsMarketplaceRow {
  marketplaceId: string;
  name: string;
  isActive: boolean;
  logisticsEnabled: boolean;
  runnerEnabled: boolean;
  /** Personas de logística activas en la plaza. */
  logisticsStaff: number;
  services: number;
  partsReceived: number;
  partsDamaged: number;
  /** Servicios por día, sobre los días corridos del periodo hasta hoy. */
  averagePerDay: number;
  /** Los días con servicios, del más reciente al más viejo. */
  days: LogisticsDay[];
}

export interface LogisticsReport {
  /** `[from, to)`, fechas de Colombia. */
  from: string;
  to: string;
  /** Días corridos del periodo hasta hoy: el divisor del promedio. */
  elapsedDays: number;
  rows: LogisticsMarketplaceRow[];
  totals: { services: number; partsReceived: number; partsDamaged: number; marketplacesWithLogistics: number };
}

const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;

/** La fecha de hoy en Colombia (`YYYY-MM-DD`). */
export function bogotaToday(now: Date = new Date()): string {
  return new Date(now.getTime() - BOGOTA_OFFSET_MS).toISOString().slice(0, 10);
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/**
 * El periodo del reporte: el mes o el año del filtro, o el mes en curso si no
 * hay filtro de fecha.
 */
export function logisticsPeriod(
  f: Pick<AccountingFilters, 'year' | 'month'>,
  today: string
): { from: string; to: string } {
  const [ay, am] = today.split('-').map(Number);
  const year = f.year ?? ay;
  const month = f.year ? f.month : am;

  if (!month) return { from: `${year}-01-01`, to: `${year + 1}-01-01` };
  const next = month === 12 ? `${year + 1}-01-01` : `${year}-${pad(month + 1)}-01`;
  return { from: `${year}-${pad(month)}-01`, to: next };
}

function diasEntre(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Días del periodo que ya pasaron o están corriendo; al menos 1 si el periodo ya empezó. */
export function elapsedDays(period: { from: string; to: string }, today: string): number {
  if (today < period.from) return 0;
  // Hoy cuenta como un día corrido; un periodo ya cerrado cuenta completo.
  const manana = addDay(today);
  const hasta = manana < period.to ? manana : period.to;
  return diasEntre(period.from, hasta);
}

function addDay(day: string): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

export function buildLogisticsReport(params: {
  period: { from: string; to: string };
  today: string;
  marketplaces: { id: string; name: string; is_active: boolean; logistics_enabled: boolean; runner_enabled: boolean }[];
  staff: { marketplace_id: string }[];
  days: LogisticsDay[];
}): LogisticsReport {
  const dias = elapsedDays(params.period, params.today);

  const personal = new Map<string, number>();
  for (const s of params.staff) personal.set(s.marketplace_id, (personal.get(s.marketplace_id) ?? 0) + 1);

  const porPlaza = new Map<string, LogisticsDay[]>();
  for (const d of params.days) {
    const lista = porPlaza.get(d.marketplaceId) ?? [];
    lista.push(d);
    porPlaza.set(d.marketplaceId, lista);
  }

  const rows: LogisticsMarketplaceRow[] = params.marketplaces.map((m) => {
    const days = [...(porPlaza.get(m.id) ?? [])].sort((a, b) => b.day.localeCompare(a.day));
    const suma = (k: 'services' | 'partsReceived' | 'partsDamaged') => days.reduce((acc, d) => acc + d[k], 0);
    const services = suma('services');
    return {
      marketplaceId: m.id,
      name: m.name,
      isActive: m.is_active,
      logisticsEnabled: m.logistics_enabled,
      runnerEnabled: m.runner_enabled,
      logisticsStaff: personal.get(m.id) ?? 0,
      services,
      partsReceived: suma('partsReceived'),
      partsDamaged: suma('partsDamaged'),
      averagePerDay: dias > 0 ? Math.round((services / dias) * 10) / 10 : 0,
      days,
    };
  });

  // Primero las que tienen logística, después las que más servicios prestaron.
  rows.sort(
    (a, b) =>
      Number(b.logisticsEnabled) - Number(a.logisticsEnabled) || b.services - a.services || a.name.localeCompare(b.name)
  );

  return {
    from: params.period.from,
    to: params.period.to,
    elapsedDays: dias,
    rows,
    totals: {
      services: rows.reduce((acc, r) => acc + r.services, 0),
      partsReceived: rows.reduce((acc, r) => acc + r.partsReceived, 0),
      partsDamaged: rows.reduce((acc, r) => acc + r.partsDamaged, 0),
      marketplacesWithLogistics: rows.filter((r) => r.logisticsEnabled).length,
    },
  };
}
