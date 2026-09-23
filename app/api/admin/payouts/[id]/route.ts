import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { requirePermission } from '@/lib/auth/require-permission';
import { fetchAllRows } from '@/lib/supabase/fetch-all';

/** El detalle de una liquidación, agrupado por tienda como sale en el archivo. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const denied = await requirePermission(supabase, 'payouts', 'read');
    if (denied) return denied;

    const service = createSupabaseServiceClient();

    const { data: payout } = await service
      .from('payouts')
      .select(
        `id, consecutive, file_name, status, scheduled_for, total_amount, items_count,
         file_path, generated_at, approved_at, cancelled_at, notes,
         generado:profiles!payouts_generated_by_fkey ( full_name ),
         aprobado:profiles!payouts_approved_by_fkey ( full_name )`
      )
      .eq('id', id)
      .maybeSingle();

    if (!payout) {
      return NextResponse.json({ error: 'La liquidación no existe.' }, { status: 404 });
    }

    const items = await fetchAllRows<any>((from, to) =>
      service
        .from('payout_items')
        .select(
          `id, store_id, amount,
           stores!inner ( name ),
           store_orders!inner ( code ),
           store_bank_accounts!inner ( bank_code, account_kind, account_number, holder_name )`
        )
        .eq('payout_id', id)
        .range(from, to)
    );

    // Un beneficiario por tienda, con sus pedidos debajo: el archivo paga una
    // vez por tienda, y revisar pedido por pedido en una lista plana no deja ver
    // cuánto va a recibir cada una.
    const porTienda = new Map<string, any>();
    for (const item of items) {
      const cuenta = item.store_bank_accounts;
      let tienda = porTienda.get(item.store_id);
      if (!tienda) {
        tienda = {
          storeId: item.store_id,
          storeName: item.stores?.name ?? 'Tienda',
          holderName: cuenta?.holder_name ?? null,
          bankCode: cuenta?.bank_code ?? null,
          accountKind: cuenta?.account_kind ?? null,
          // Solo los últimos cuatro: no hace falta el número completo para
          // revisar, y la pantalla queda menos expuesta.
          accountLast4: String(cuenta?.account_number ?? '').slice(-4),
          amount: 0,
          orders: [] as { id: string; code: string | null; amount: number }[],
        };
        porTienda.set(item.store_id, tienda);
      }
      tienda.amount += Number(item.amount);
      tienda.orders.push({
        id: item.id,
        code: item.store_orders?.code ?? null,
        amount: Number(item.amount),
      });
    }

    return NextResponse.json(
      {
        data: {
          id: payout.id,
          consecutive: payout.consecutive,
          fileName: payout.file_name,
          status: payout.status,
          scheduledFor: payout.scheduled_for,
          totalAmount: Number(payout.total_amount),
          itemsCount: payout.items_count,
          hasFile: !!payout.file_path,
          generatedAt: payout.generated_at,
          approvedAt: payout.approved_at,
          cancelledAt: payout.cancelled_at,
          generatedByName: (payout as any).generado?.full_name ?? null,
          approvedByName: (payout as any).aprobado?.full_name ?? null,
          notes: payout.notes,
          stores: Array.from(porTienda.values()).sort((a, b) =>
            a.storeName.localeCompare(b.storeName, 'es')
          ),
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
