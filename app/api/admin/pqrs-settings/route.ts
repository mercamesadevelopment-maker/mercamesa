import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';

/**
 * Los plazos de las PQRS, con su histórico.
 *
 * Append-only, como las tarifas y los parámetros de dispersión: cada cambio es
 * una fila nueva y la más reciente es la que aplica.
 *
 * La tabla no tiene políticas, así que se lee y se escribe con el cliente de
 * servicio después de comprobar el permiso con la sesión.
 */
async function autorizar(action: 'read' | 'create') {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { user: null, denied: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  }

  const { data: puede } = await supabase.rpc('has_permission', {
    module_key: 'system-settings',
    action_name: action,
  });
  if (!puede) {
    return {
      user: null,
      denied: NextResponse.json({ error: 'No tienes permisos para los plazos de PQRS' }, { status: 403 }),
    };
  }

  return { user, denied: null };
}

/** Mayor plazo aceptado: 30 días. Más que eso es un error de digitación. */
const MAX_HORAS = 720;

export async function GET() {
  try {
    const { denied } = await autorizar('read');
    if (denied) return denied;

    const service = createSupabaseServiceClient() as unknown as SupabaseClient<any>;
    const { data, error } = await service
      .from('pqrs_settings_history')
      .select('*, profiles ( full_name )')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('pqrs-settings: no se pudo leer', error);
      return NextResponse.json({ error: 'No se pudieron cargar los plazos.' }, { status: 500 });
    }

    return NextResponse.json({ data: (data ?? []).map(aCamello) }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, denied } = await autorizar('create');
    if (denied || !user) return denied!;

    const body = await request.json().catch(() => ({}));

    const claimWindowHours = Number(body.claimWindowHours);
    const storeResponseHours = Number(body.storeResponseHours);

    const plazos: [number, string][] = [
      [claimWindowHours, 'El plazo para reclamar'],
      [storeResponseHours, 'El plazo de respuesta de la tienda'],
    ];
    for (const [valor, nombre] of plazos) {
      if (!Number.isInteger(valor) || valor < 1 || valor > MAX_HORAS) {
        return NextResponse.json(
          { error: `${nombre} debe ser un número entero de horas, entre 1 y ${MAX_HORAS}.` },
          { status: 400 }
        );
      }
    }

    const service = createSupabaseServiceClient() as unknown as SupabaseClient<any>;
    const { data, error } = await service
      .from('pqrs_settings_history')
      .insert({
        claim_window_hours: claimWindowHours,
        store_response_hours: storeResponseHours,
        notes: body.notes ? String(body.notes).trim() : null,
        changed_by: user.id,
      })
      .select('*, profiles ( full_name )')
      .single();

    if (error) {
      console.error('pqrs-settings: no se pudo guardar', error);
      return NextResponse.json({ error: 'No se pudieron guardar los plazos.' }, { status: 500 });
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
    claimWindowHours: row.claim_window_hours,
    storeResponseHours: row.store_response_hours,
    notes: row.notes,
    createdAt: row.created_at,
    changedByName: row.profiles?.full_name ?? null,
  };
}
