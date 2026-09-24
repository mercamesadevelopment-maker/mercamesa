import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { requirePermission } from '@/lib/auth/require-permission';
import { calcularElegibilidad, EXPLICACION_DESCARTE } from '@/lib/payouts/build-draft';
import { PayoutConfigError } from '@/lib/payouts/settings';

/**
 * Qué se dispersaría ahora mismo, sin crear nada.
 *
 * Existe aparte del POST para que el superadmin pueda mirar antes de decidir. Un
 * borrador vacío o con una tienda de menos ensucia la lista y hay que
 * cancelarlo; esto no deja rastro.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const denied = await requirePermission(supabase, 'payouts', 'read');
    if (denied) return denied;

    const service = createSupabaseServiceClient();
    const { elegibles, descartados, total, settings } = await calcularElegibilidad(service);

    // Agrupado por tienda: es como se va a ver en el archivo y como lo lee quien
    // revisa, que piensa en "a quién le pago", no en "qué pedidos".
    const porTienda = new Map<string, { storeId: string; storeName: string; orders: number; amount: number }>();
    for (const e of elegibles) {
      const actual = porTienda.get(e.storeId);
      if (actual) {
        actual.orders += 1;
        actual.amount += e.amount;
      } else {
        porTienda.set(e.storeId, {
          storeId: e.storeId,
          storeName: e.storeName,
          orders: 1,
          amount: e.amount,
        });
      }
    }

    return NextResponse.json(
      {
        data: {
          total,
          ordersCount: elegibles.length,
          stores: Array.from(porTienda.values()).sort((a, b) =>
            a.storeName.localeCompare(b.storeName, 'es')
          ),
          // Con la razón ya en español: la pantalla no tiene por qué conocer los
          // códigos internos.
          discarded: descartados.map((d) => ({
            storeOrderId: d.storeOrderId,
            storeOrderCode: d.storeOrderCode,
            storeName: d.storeName,
            amount: d.amount,
            reason: d.reason,
            reasonLabel: EXPLICACION_DESCARTE[d.reason],
          })),
          holdDays: settings.holdDays,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    if (error instanceof PayoutConfigError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
