import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { construirBorrador, SinPedidosError } from '@/lib/payouts/build-draft';
import { PayoutConfigError } from '@/lib/payouts/settings';

/**
 * El borrador de los martes y jueves.
 *
 * Lo llama pg_cron (`payouts_draft`, 11:00 UTC = 6:00 a. m. de Colombia) a
 * través de `call_app_cron`, que lee la URL y el secreto de Vault.
 *
 * Deja un borrador y nada más. No genera el archivo ni lo manda a ninguna parte:
 * eso pasa cuando el superadmin lo revisa y lo aprueba. Un proceso automático
 * que produjera órdenes de pago listas para subir al banco sin que nadie las
 * mire no es algo que valga la pena ahorrarse.
 */
export async function POST(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization');

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const service = createSupabaseServiceClient();
    const borrador = await construirBorrador(service);

    console.log(
      `[cron] payouts: borrador ${borrador.payoutId} con ${borrador.itemsCount} pedidos ` +
        `de ${borrador.storesCount} tiendas, ${borrador.descartados.length} descartados`
    );

    return NextResponse.json(
      {
        created: true,
        payoutId: borrador.payoutId,
        itemsCount: borrador.itemsCount,
        storesCount: borrador.storesCount,
        totalAmount: borrador.totalAmount,
        discardedCount: borrador.descartados.length,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    // Que no haya nada que dispersar es lo normal un martes flojo, y que falten
    // los parámetros es una tarea pendiente. Ninguno de los dos es un fallo, así
    // que van con 200: un 500 acá dispararía alertas cada semana por nada.
    if (error instanceof SinPedidosError || error instanceof PayoutConfigError) {
      console.log(`[cron] payouts: sin borrador — ${error.message}`);
      return NextResponse.json({ created: false, reason: error.message }, { status: 200 });
    }

    const message = error instanceof Error ? error.message : 'Error generando el borrador';
    console.error('[cron] payouts:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
