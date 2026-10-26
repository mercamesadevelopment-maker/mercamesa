import type { SupabaseClient } from '@supabase/supabase-js';
import type { BalanceRequest } from '@/lib/siigo/balance-params';
import type { SiigoTestBalanceResponse } from '@/lib/siigo/types';
import { loadPeopleNames } from './context';

/** Un balance del historial, como lo muestra la pantalla. */
export interface BalanceReport {
  id: string;
  kind: 'general' | 'third_party';
  year: number;
  monthStart: number;
  monthEnd: number;
  accountStart: string | null;
  accountEnd: string | null;
  includesTaxDifference: boolean;
  identification: string | null;
  branchOffice: number | null;
  thirdPartyName: string | null;
  fileUrl: string;
  createdAt: string;
  createdByName: string | null;
}

const COLUMNS = `id, kind, year, month_start, month_end, account_start, account_end, includes_tax_difference,
  identification, branch_office, third_party_name, file_url, created_by, created_at`;

/** Guarda un balance recién generado en el historial. */
export async function saveBalanceReport(
  service: SupabaseClient<any>,
  request: BalanceRequest,
  result: SiigoTestBalanceResponse & { file_url: string },
  userId: string
): Promise<BalanceReport> {
  const { payload } = request;
  const { data, error } = await service
    .from('siigo_balance_reports')
    .insert({
      kind: request.kind,
      year: payload.year,
      month_start: payload.month_start,
      month_end: payload.month_end,
      account_start: payload.account_start ?? null,
      account_end: payload.account_end ?? null,
      includes_tax_difference: payload.includes_tax_difference,
      identification: payload.customer?.identification ?? null,
      branch_office: payload.customer?.branch_office ?? null,
      third_party_name: request.thirdPartyName,
      file_id: result.file_id,
      file_url: result.file_url,
      created_by: userId,
    })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return (await withNames(service, [data]))[0];
}

/** Los balances más recientes. */
export async function listBalanceReports(service: SupabaseClient<any>, limit = 50): Promise<BalanceReport[]> {
  const { data, error } = await service
    .from('siigo_balance_reports')
    .select(COLUMNS)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return withNames(service, data ?? []);
}

async function withNames(service: SupabaseClient<any>, rows: any[]): Promise<BalanceReport[]> {
  const nombres = await loadPeopleNames(service, rows.map((r) => r.created_by));
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    year: r.year,
    monthStart: r.month_start,
    monthEnd: r.month_end,
    accountStart: r.account_start,
    accountEnd: r.account_end,
    includesTaxDifference: r.includes_tax_difference,
    identification: r.identification,
    branchOffice: r.branch_office,
    thirdPartyName: r.third_party_name,
    fileUrl: r.file_url,
    createdAt: r.created_at,
    createdByName: r.created_by ? nombres.get(r.created_by) ?? null : null,
  }));
}

/**
 * Compradores que ya son terceros en Siigo: los de algún pedido con factura
 * enviada. Es con quienes la integración crea terceros (`ensureCustomer`, con
 * `profiles.document_number` y sucursal 0).
 */
export async function searchSiigoBuyers(
  service: SupabaseClient<any>,
  query: string
): Promise<{ name: string; identification: string }[]> {
  const like = `%${query}%`;
  const { data: perfiles, error } = await service
    .from('profiles')
    .select('id, full_name, document_number')
    .not('document_number', 'is', null)
    .or(`full_name.ilike.${like},document_number.ilike.${like},email.ilike.${like}`)
    .limit(100);
  if (error) throw new Error(error.message);
  if (!perfiles?.length) return [];

  // De esos, los que tienen una factura enviada a Siigo.
  const { data: facturados, error: e2 } = await service
    .from('orders')
    .select('buyer_id, siigo_invoices!inner ( status )')
    .eq('siigo_invoices.status', 'sent')
    .in('buyer_id', perfiles.map((p) => p.id));
  if (e2) throw new Error(e2.message);
  const enSiigo = new Set((facturados ?? []).map((o) => o.buyer_id));

  return perfiles
    .filter((p) => enSiigo.has(p.id))
    .slice(0, 20)
    .map((p) => ({ name: p.full_name?.trim() || 'Sin nombre', identification: p.document_number as string }));
}
