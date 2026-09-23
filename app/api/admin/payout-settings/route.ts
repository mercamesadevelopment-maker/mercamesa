import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Los datos del ordenante, con su histórico.
 *
 * Append-only, como las tarifas: cada cambio es una fila nueva y la más reciente
 * es la que aplica. Cada liquidación guarda contra qué fila se generó, así que
 * cambiar la cuenta hoy no reescribe de dónde salió el dinero en marzo.
 *
 * No usa `requirePermission` por lo mismo que `pricing-settings`: hace falta el
 * `user.id` para `changed_by`, y la RPC se llama igual por dentro.
 */

/** Todo lo que el banco exige y nadie más sabe. */
const OBLIGATORIOS = [
  'ordererDocumentNumber',
  'ordererName',
  'ordererAddress',
  'ordererCity',
  'bbvaOfficeCode',
  'bbvaAccountNumber',
  'emitterKey',
] as const;

const ETIQUETAS: Record<string, string> = {
  ordererDocumentNumber: 'el NIT',
  ordererName: 'el nombre del ordenante',
  ordererAddress: 'la dirección',
  ordererCity: 'la ciudad',
  bbvaOfficeCode: 'el código de oficina',
  bbvaAccountNumber: 'el número de cuenta',
  emitterKey: 'la clave del emisor',
};

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

    const faltantes = OBLIGATORIOS.filter((c) => !String(body[c] ?? '').trim());
    if (faltantes.length > 0) {
      return NextResponse.json(
        { error: `Falta ${faltantes.map((f) => ETIQUETAS[f]).join(', ')}.` },
        { status: 400 }
      );
    }

    // El dígito de verificación es un solo carácter y el banco lo compara contra
    // el NIT. Uno de dos dígitos correría todo el registro.
    const dv = String(body.ordererDv ?? '0').trim();
    if (!/^\d$/.test(dv)) {
      return NextResponse.json(
        { error: 'El dígito de verificación es un solo número (0 a 9).' },
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

    const offset = Number(body.fileConsecutiveOffset ?? 0);
    if (!Number.isInteger(offset) || offset < 0) {
      return NextResponse.json(
        { error: 'El desfase del consecutivo debe ser un número entero de cero en adelante.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('payout_settings_history')
      .insert({
        orderer_document_type: String(body.ordererDocumentType ?? '03'),
        orderer_document_number: String(body.ordererDocumentNumber).trim(),
        orderer_dv: dv,
        orderer_suffix: String(body.ordererSuffix ?? '01'),
        orderer_name: String(body.ordererName).trim(),
        orderer_address: String(body.ordererAddress).trim(),
        orderer_city: String(body.ordererCity).trim(),
        bbva_office_code: String(body.bbvaOfficeCode).trim(),
        bbva_account_number: String(body.bbvaAccountNumber).trim(),
        emitter_key: String(body.emitterKey).trim(),
        payment_concept: String(body.paymentConcept ?? 'Pago de ventas MercaMesa').trim(),
        file_consecutive_offset: offset,
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
    ordererDocumentType: row.orderer_document_type,
    ordererDocumentNumber: row.orderer_document_number,
    ordererDv: row.orderer_dv,
    ordererSuffix: row.orderer_suffix,
    ordererName: row.orderer_name,
    ordererAddress: row.orderer_address,
    ordererCity: row.orderer_city,
    bbvaOfficeCode: row.bbva_office_code,
    bbvaAccountNumber: row.bbva_account_number,
    emitterKey: row.emitter_key,
    paymentConcept: row.payment_concept,
    fileConsecutiveOffset: row.file_consecutive_offset,
    holdDays: row.hold_days,
    notes: row.notes,
    createdAt: row.created_at,
    changedByName: row.profiles?.full_name ?? null,
  };
}
