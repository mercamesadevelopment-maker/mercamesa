import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Las cifras del tablero del comprador.
 *
 * Hasta ahora la pantalla las sacaba de `DEFAULT_BUYER_PROFILE`, o sea que a
 * cualquier persona recién registrada le decía que llevaba 23 pedidos y
 * $1.240.000 gastados. Esto las trae de la base.
 *
 * Se consulta `orders` y NO `orders_detail_view`: la vista devuelve una fila por
 * tienda, así que una compra repartida entre dos tiendas contaría como dos
 * pedidos. Para el comprador, esa compra fue una.
 *
 * Las tres consultas van con `count: 'exact', head: true`: no viaja ni una fila,
 * solo el número. Es el mismo truco que ya usa el panel del tendero.
 */

/** No cuentan como compra: una se deshizo y la otra se devolvió. */
const SIN_VALOR = ['cancelled', 'returned'];

/** Ya terminaron su ciclo, para bien o para mal. */
const TERMINADOS = ['delivered', ...SIN_VALOR];

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const enLista = (valores: string[]) => `(${valores.join(',')})`;

    const [total, enCurso, perfil] = await Promise.all([
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('buyer_id', user.id)
        .not('status', 'in', enLista(SIN_VALOR)),

      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('buyer_id', user.id)
        .not('status', 'in', enLista(TERMINADOS)),

      supabase.from('profiles').select('created_at').eq('id', user.id).maybeSingle(),
    ]);

    if (total.error || enCurso.error) {
      console.error('profile/stats: no se pudieron contar', total.error ?? enCurso.error);
      return NextResponse.json(
        { error: 'No se pudieron cargar tus estadísticas.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        data: {
          totalOrders: total.count ?? 0,
          inProgress: enCurso.count ?? 0,
          memberSince: perfil.data?.created_at ?? null,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
