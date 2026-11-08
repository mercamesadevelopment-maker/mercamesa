import type { SupabaseClient } from '@supabase/supabase-js';
import type { AccountingFilters } from './filters';
import { bogotaToday, buildLogisticsReport, logisticsPeriod, type LogisticsReport } from './logistics-report';

/**
 * Lee de la base lo que necesita el reporte de logística: las plazas, su
 * personal de logística activo y los servicios por día (la función SQL
 * `logistics_services_by_day`, para no traer filas sueltas).
 *
 * Solo aplica el filtro de plaza y el de fecha: comprador y tienda no dicen
 * nada de un servicio de la bahía.
 */
export async function loadLogisticsReport(
  service: SupabaseClient<any>,
  filters: AccountingFilters
): Promise<LogisticsReport> {
  const today = bogotaToday();
  const period = logisticsPeriod(filters, today);

  let plazas = service.from('marketplaces').select('id, name, is_active, logistics_enabled, runner_enabled').order('name');
  let personal = service.from('marketplace_staff').select('marketplace_id').eq('role', 'logistics').eq('is_active', true);
  if (filters.marketplaceId) {
    plazas = plazas.eq('id', filters.marketplaceId);
    personal = personal.eq('marketplace_id', filters.marketplaceId);
  }

  const [{ data: marketplaces, error: e1 }, { data: staff, error: e2 }, { data: dias, error: e3 }] = await Promise.all([
    plazas,
    personal,
    service.rpc('logistics_services_by_day', {
      p_from: period.from,
      p_to: period.to,
      p_marketplace: filters.marketplaceId ?? undefined,
    }),
  ]);
  const error = e1 ?? e2 ?? e3;
  if (error) throw new Error(`No se pudo cargar el reporte de logística: ${error.message}`);

  return buildLogisticsReport({
    period,
    today,
    marketplaces: (marketplaces ?? []) as any[],
    staff: (staff ?? []) as any[],
    days: ((dias ?? []) as any[]).map((d) => ({
      marketplaceId: d.marketplace_id,
      day: d.day,
      services: Number(d.services),
      partsReceived: Number(d.parts_received),
      partsDamaged: Number(d.parts_damaged),
    })),
  });
}
