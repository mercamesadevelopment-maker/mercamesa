import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentLegalDocuments } from '@/lib/legal/current-documents';

/**
 * Los documentos legales vigentes. **Sin sesión**: quien todavía no tiene cuenta
 * tiene que poder leerlos antes de aceptarlos, y el pie de la página de inicio
 * los enlaza para cualquier visitante.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const documents = await getCurrentLegalDocuments(supabase);

    return NextResponse.json({ data: documents }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
