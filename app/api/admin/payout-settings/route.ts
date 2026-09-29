import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Los parámetros de dispersión, con su histórico.
 *
 * Append-only, como las tarifas: cada cambio es una fila nueva y la más reciente
 * es la que aplica. Cada liquidación guarda contra qué fila se generó.
 *
 * En el formato por líneas de BBVA el archivo no lleva datos del ordenante: queda
 * el concepto de pago —el Concepto 1 de cada línea— y los días de espera.
 *
 * No usa `requirePermission` por lo mismo que `pricing-settings`: hace falta el
 * `user.id` para `changed_by`, y la RPC se llama igual por dentro.
 */

/** El ancho del campo Concepto 1 en el archivo. Lo que sobre se cortaría. */
const MAX_CONCEPTO = 40;

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { data: puede } = await supabase.rpc('has_permission', {
      module_key: 'payouts',
      action_name: 'read',
    });
    if (!puede) {
      return NextResponse.json({ error: 'No tienes permisos para ver esto' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('payout_settings_history')
      .select('*, profiles ( full_name )')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('payout-settings: no se pudo leer', error);
      return NextResponse.json(
        { error: 'No se pudieron cargar los parámetros.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: (data ?? []).map(aCamello) }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { data: puede } = await supabase.rpc('has_permission', {
      module_key: 'payouts',
      action_name: 'create',
    });
    if (!puede) {
      return NextResponse.json(
        { error: 'No tienes permisos para cambiar los parámetros de dispersión' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));

    const concepto = String(body.paymentConcept ?? '').trim();
    if (!concepto) {
      return NextResponse.json({ error: 'Falta el concepto de pago.' }, { status: 400 });
    }
    // Se rechaza en vez de cortar: el concepto es lo que la tienda lee en su
    // extracto, y uno cortado a la mitad se lee mal.
    if (concepto.length > MAX_CONCEPTO) {
      return NextResponse.json(
        { error: `El concepto de pago no puede pasar de ${MAX_CONCEPTO} caracteres; el que enviaste tiene ${concepto.length}.` },
        { status: 400 }
      );
    }

    const holdDays = Number(body.holdDays ?? 3);
    if (!Number.isInteger(holdDays) || holdDays < 0) {
      return NextResponse.json(
        { error: 'Los días de espera deben ser un número entero de cero en adelante.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('payout_settings_history')
      .insert({
        payment_concept: concepto,
        hold_days: holdDays,
        notes: body.notes ? String(body.notes).trim() : null,
        changed_by: user.id,
      })
      .select('*, profiles ( full_name )')
      .single();

    if (error) {
      console.error('payout-settings: no se pudo guardar', error);
      return NextResponse.json({ error: 'No se pudieron guardar los parámetros.' }, { status: 500 });
    }

    return NextResponse.json({ data: aCamello(data) }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function aCamello(row: any) {
  return {
    id: row.id,
    paymentConcept: row.payment_concept,
    holdDays: row.hold_days,
    notes: row.notes,
    createdAt: row.created_at,
    changedByName: row.profiles?.full_name ?? null,
  };
}
