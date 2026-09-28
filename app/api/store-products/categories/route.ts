import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';

/**
 * Las categorías que tienen productos publicados, para el carrusel de la vitrina.
 *
 * El carrusel las sacaba de los productos ya cargados en el navegador. Al
 * paginar contra el servidor solo vería las de la página actual, así que
 * necesita su propia fuente.
 *
 * No sirve la lista completa de `categories`: mostraría categorías vacías que al
 * tocarlas no devuelven nada. `vitrina_categorias` cuenta sobre la misma vista
 * que sirve los productos, así que no pueden discrepar.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const storeId = new URL(request.url).searchParams.get('store_id');

  const { data, error } = await supabase.rpc('vitrina_categorias', {
    p_store_id: storeId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data: data ?? [] }, { status: 200 });
}
