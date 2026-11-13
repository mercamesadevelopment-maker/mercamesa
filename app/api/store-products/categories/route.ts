import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { toCategoryTree } from '@/lib/store-products/category-tree';

/**
 * Las categorías con productos publicados, en dos niveles (categoría y sus
 * subcategorías), para el carrusel de la vitrina.
 *
 * No sirve la lista completa de `categories`: mostraría categorías vacías que al
 * tocarlas no devuelven nada. `vitrina_arbol_categorias` cuenta sobre la misma
 * vista que sirve los productos, así que no pueden discrepar.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const storeId = new URL(request.url).searchParams.get('store_id');

  const { data, error } = await supabase.rpc('vitrina_arbol_categorias', {
    p_store_id: storeId ?? undefined,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data: toCategoryTree(data ?? []) }, { status: 200 });
}
