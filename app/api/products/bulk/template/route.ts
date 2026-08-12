import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/require-permission';
import {
  CATALOG_TEMPLATE_FILENAME,
  buildCatalogTemplate,
  loadCatalogLookups,
} from '@/lib/catalog-import';
import { XLSX_MIME } from '@/lib/product-import/constants';

export async function GET() {
  try {
    const supabase = await createClient();

    const denied = await requirePermission(
      supabase,
      'system-settings',
      'create',
      'No tienes permisos para crear productos del catálogo'
    );
    if (denied) return denied;

    const { categories, units, storeGroups } = await loadCatalogLookups(supabase);
    const buffer = await buildCatalogTemplate({ categories, units, storeGroups });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': XLSX_MIME,
        'Content-Disposition': `attachment; filename="${CATALOG_TEMPLATE_FILENAME}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    console.error('Error generando la plantilla del catálogo:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
