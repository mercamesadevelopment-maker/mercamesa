import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { requirePermission, type PermissionAction } from '@/lib/auth/require-permission';
import { parseAccountingFilters, type AccountingFilters } from './filters';
import { resolveAccountingScope, type AccountingScope } from './scope';
import { loadStoresContext, type StoresContext } from './context';
import { pageParams } from './paginate';

export interface AccountingRequest {
  service: SupabaseClient<any>;
  userId: string;
  filters: AccountingFilters;
  scope: AccountingScope;
  stores: StoresContext;
  page: { page: number; pageSize: number };
}

/**
 * Lo común a las rutas de Contabilidad: el permiso del módulo, los filtros de
 * la URL y a qué tiendas y personas se reducen. Devuelve la respuesta de error
 * si no hay permiso.
 */
export async function accountingRequest(
  request: Request,
  action: PermissionAction = 'read'
): Promise<{ error: NextResponse } | { ctx: AccountingRequest }> {
  const auth = await accountingAuth(action);
  if ('error' in auth) return auth;
  const { service, userId } = auth;

  const params = new URL(request.url).searchParams;
  const filters = parseAccountingFilters(params);
  const [scope, stores] = await Promise.all([resolveAccountingScope(service, filters), loadStoresContext(service)]);

  return { ctx: { service, userId, filters, scope, stores, page: pageParams(params) } };
}

/** Solo el permiso del módulo y la sesión, para las rutas que no usan los filtros. */
export async function accountingAuth(
  action: PermissionAction = 'read'
): Promise<{ error: NextResponse } | { service: SupabaseClient<any>; userId: string }> {
  const supabase = await createClient();
  const denied = await requirePermission(supabase, 'accounting', action, 'No tienes acceso a Contabilidad.');
  if (denied) return { error: denied };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };

  return { service: createSupabaseServiceClient() as unknown as SupabaseClient<any>, userId: user.id };
}

export function serverError(where: string, error: unknown): NextResponse {
  console.error(`${where}:`, error);
  return NextResponse.json({ error: 'No se pudo cargar la información.' }, { status: 500 });
}
