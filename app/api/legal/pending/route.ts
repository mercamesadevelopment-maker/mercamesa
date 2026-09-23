import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPendingLegalDocuments } from '@/lib/legal/current-documents';

/**
 * Qué documentos vigentes le falta aceptar a quien pregunta.
 *
 * Lo consulta la pantalla bloqueante del shell. Devuelve lista vacía —no un
 * error— cuando no hay sesión: la pantalla no tiene nada que hacer ahí, y un 401
 * obligaría a distinguir dos casos que se resuelven igual.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ data: [] }, { status: 200 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('roles ( name )')
      .eq('id', user.id)
      .single();

    const roleName = (profile as any)?.roles?.name ?? null;

    const pending = await getPendingLegalDocuments(supabase, user.id, roleName);

    return NextResponse.json({ data: pending }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
