import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { canManageStore } from '@/lib/auth/can-manage-store';
import { listStorefront } from '@/lib/store-products/storefront';
import { listForManagement } from '@/lib/store-products/management';
import { assignToStores, createStoreProduct } from '@/lib/store-products/create';

const mensaje = (error: unknown, porDefecto: string) => (error instanceof Error ? error.message : porDefecto);

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get('store_id');

  const {
    data: { user },
  } = await supabase.auth.getUser();

  /**
   * Esta ruta sirve TRES usos distintos, no dos, y confundir dos de ellos es lo
   * que tenía el `select('*')` abierto:
   *
   * - **Gestión**: el panel de una tienda sobre sus propios productos. Necesita
   *   también los inactivos y su precio mayorista.
   * - **Catálogo**: /admin/catalog, que consulta SIN `store_id` y necesita las
   *   mismas columnas completas. Acá se confundía con la vitrina.
   * - **Vitrina**: compradores y visitantes. Solo lo publicado y solo las
   *   columnas que pinta la tarjeta.
   *
   * Antes solo se distinguía "gestión" de "todo lo demás", y lo único que se
   * reservaba era el conteo de pedidos: a cualquiera sin sesión le llegaban
   * `wholesale_price`, `stock` y `code` de todos los productos.
   */
  const esGestion = !!storeId && !!user && (await canManageStore(supabase, storeId, user.id));

  let esCatalogo = false;
  if (!esGestion && user) {
    // El mismo módulo que protege /admin/catalog (admin, superadmin y
    // b2chat_integration).
    const { data: puedeVerCatalogo } = await supabase.rpc('has_permission', {
      module_key: 'catalog',
      action_name: 'read',
    });
    esCatalogo = puedeVerCatalogo === true;
  }

  if (esGestion || esCatalogo) {
    try {
      const data = await listForManagement(supabase, searchParams, storeId, esGestion);
      return NextResponse.json({ data }, { status: 200 });
    } catch (error: unknown) {
      return NextResponse.json({ error: mensaje(error, 'Error consultando los productos') }, { status: 400 });
    }
  }

  try {
    const { data, count, paginated } = await listStorefront(supabase, searchParams, storeId);
    return NextResponse.json(paginated ? { data, count } : { data }, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json({ error: mensaje(error, 'Error consultando el catálogo') }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Un arreglo es la asignación masiva del admin; un objeto, una tienda que
    // publica un producto.
    const result = Array.isArray(body)
      ? await assignToStores(supabase, user.id, body)
      : await createStoreProduct(supabase, user.id, body);

    if ('message' in result) return NextResponse.json({ error: result.message }, { status: result.status });
    return NextResponse.json({ data: result.data }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: mensaje(error, 'Internal Server Error') }, { status: 500 });
  }
}
