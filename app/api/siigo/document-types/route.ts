import { NextRequest, NextResponse } from "next/server";
import { getDocumentTypes } from "@/lib/siigo";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/require-permission";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Estas rutas exponen datos contables del cliente. Antes no verificaban ni
    // sesion: cualquiera podia consultarlas.
    const denied = await requirePermission(
      supabase,
      'system-settings',
      'read',
      'No tienes permisos para consultar datos de Siigo'
    );
    if (denied) return denied;

    const { searchParams } = request.nextUrl;
    const type = searchParams.get("type") || undefined;

    const data = await getDocumentTypes(type);
    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
