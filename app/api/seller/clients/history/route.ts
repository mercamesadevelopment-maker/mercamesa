import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { canManageStore, isPlatformAdmin } from '@/lib/auth/can-manage-store';
import { loadStoreClients } from '@/lib/stores/load-store-clients';

/**
 * Los clientes de una tienda, o de todas las que ve quien pregunta
 * (`?store_id=all`), con su historial de pedidos.
 *
 * Lo arma el servidor: los pedidos y los datos de los compradores no se leen
 * desde el navegador.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const storeId = new URL(request.url).searchParams.get('store_id') ?? '';
    if (!storeId) return NextResponse.json({ error: 'Falta la tienda.' }, { status: 400 });

    const service = createSupabaseServiceClient() as unknown as SupabaseClient<any>;
    const esPlataforma = await isPlatformAdmin(supabase, user.id);

    if (storeId !== 'all' && !(await canManageStore(supabase, storeId, user.id))) {
      return NextResponse.json({ error: 'No tienes acceso a esta tienda.' }, { status: 403 });
    }

    const stores = await storesInScope(service, user.id, storeId, esPlataforma);
    const data = await loadStoreClients(service, stores, {
      includeClientsWithoutOrders: storeId === 'all' && esPlataforma,
    });
    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    console.error('seller/clients/history GET:', error);
    return NextResponse.json({ error: 'No se pudieron cargar los clientes.' }, { status: 500 });
  }
}

/** La tienda pedida, o todas: las de la plataforma para un admin, las suyas para un tendero. */
async function storesInScope(
  service: SupabaseClient<any>,
  userId: string,
  storeId: string,
  esPlataforma: boolean
): Promise<{ id: string; name: string }[]> {
  if (storeId !== 'all') {
    const { data, error } = await service.from('stores').select('id, name').eq('id', storeId);
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  if (esPlataforma) {
    const { data, error } = await service.from('stores').select('id, name');
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  const { data, error } = await service
    .from('store_members')
    .select('stores ( id, name )')
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  return (data ?? []).flatMap((m: any) => (m.stores ? [m.stores] : []));
}
