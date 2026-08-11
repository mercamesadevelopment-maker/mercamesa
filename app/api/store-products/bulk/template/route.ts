import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { canManageStore } from '@/lib/auth/can-manage-store';
import { XLSX_MIME, buildTemplateWorkbook, type TemplateProduct } from '@/lib/product-import';

/** Quita tildes y espacios raros para un nombre de archivo seguro. */
function toFileSlug(value: string): string {
  return (
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'tienda'
  );
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storeId = new URL(request.url).searchParams.get('store_id');
    if (!storeId) {
      return NextResponse.json({ error: 'Falta el parámetro store_id.' }, { status: 400 });
    }

    if (!(await canManageStore(supabase, storeId, user.id))) {
      return NextResponse.json(
        { error: 'No tienes permisos sobre esta tienda.' },
        { status: 403 }
      );
    }

    const [storeRes, catalogRes, unitsRes, publishedRes] = await Promise.all([
      supabase.from('stores').select('name').eq('id', storeId).single(),
      supabase
        .from('catalog_products')
        .select('id, name, slug, default_unit_id, categories ( name, parent_id )')
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('measurement_units')
        .select('id, name, abbreviation')
        .eq('is_active', true)
        .order('name'),
      supabase.from('store_products').select('catalog_product_id').eq('store_id', storeId),
    ]);

    if (catalogRes.error) throw new Error(catalogRes.error.message);
    if (unitsRes.error) throw new Error(unitsRes.error.message);
    if (publishedRes.error) throw new Error(publishedRes.error.message);

    const units = unitsRes.data ?? [];
    const abbreviationByUnitId = new Map(units.map((unit) => [unit.id, unit.abbreviation]));
    const published = new Set((publishedRes.data ?? []).map((row) => row.catalog_product_id));

    // categories se auto-referencia por parent_id y PostgREST no resuelve el
    // embed anidado de la tabla dentro de sí misma, así que el nombre del padre
    // se resuelve acá con un mapa (mismo enfoque que GET /api/store-products).
    const parentIds = Array.from(
      new Set(
        (catalogRes.data ?? [])
          .map((product) => (product.categories as any)?.parent_id)
          .filter((id): id is string => !!id)
      )
    );

    let parentNameById = new Map<string, string>();
    if (parentIds.length > 0) {
      const { data: parents } = await supabase
        .from('categories')
        .select('id, name')
        .in('id', parentIds);
      parentNameById = new Map((parents ?? []).map((category) => [category.id, category.name]));
    }

    const products: TemplateProduct[] = (catalogRes.data ?? [])
      // Los ya publicados se omiten: al subirlos volverían como "omitidos" y
      // solo harían más larga una hoja que ya trae cientos de filas.
      .filter((product) => !published.has(product.id))
      .map((product) => {
        const category = product.categories as any;
        const parentName = category?.parent_id ? parentNameById.get(category.parent_id) ?? '' : '';
        return {
          code: product.slug,
          name: product.name,
          // Si la categoría no tiene padre, ella misma es la categoría raíz.
          category: parentName || category?.name || '',
          subcategory: parentName ? category?.name ?? '' : '',
          unit: product.default_unit_id
            ? abbreviationByUnitId.get(product.default_unit_id) ?? ''
            : '',
        };
      })
      .sort(
        (a, b) =>
          a.category.localeCompare(b.category, 'es') ||
          a.subcategory.localeCompare(b.subcategory, 'es') ||
          a.name.localeCompare(b.name, 'es')
      );

    const storeName = storeRes.data?.name ?? 'Mi tienda';
    const buffer = await buildTemplateWorkbook({ storeName, products, units });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': XLSX_MIME,
        'Content-Disposition': `attachment; filename="plantilla-productos-${toFileSlug(storeName)}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    console.error('Error generando la plantilla de productos:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
