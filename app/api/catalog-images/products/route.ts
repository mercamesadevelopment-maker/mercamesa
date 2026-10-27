import { NextResponse } from 'next/server';
import { catalogImageAuth, serverError, storeIdFrom } from '@/lib/catalog-images/route-helpers';
import { fetchAllRows } from '@/lib/supabase/fetch-all';

interface Row {
  id: string;
  slug: string;
  name: string;
  image_url: string | null;
}

/**
 * Los productos a los que quien pregunta les puede poner foto: todo el catálogo
 * para el admin; para una tienda, los de su grupo y los que propuso y siguen en
 * revisión. El navegador asocia cada foto a uno de estos por el nombre del
 * archivo, y con la misma lista arma el Excel de códigos.
 */
export async function GET(request: Request) {
  try {
    const auth = await catalogImageAuth(storeIdFrom(new URL(request.url).searchParams.get('storeId')));
    if ('error' in auth) return auth.error;
    const { service, actor } = auth;

    let filas: Row[] = [];
    if (actor.kind === 'admin') {
      filas = await fetchAllRows<Row>((from, to) =>
        service.from('catalog_products').select('id, slug, name, image_url').order('name').range(from, to)
      );
    } else {
      // Mismo criterio que `canEditCatalogImage`: los propuestos en revisión
      // son de quien los propuso, aunque estén marcados con un grupo.
      const propios = `and(review_status.eq.pending,proposed_by_store_id.eq.${actor.storeId})`;
      const filtro = actor.groupId
        ? `and(review_status.neq.pending,owner_group_id.eq.${actor.groupId}),${propios}`
        : propios;
      filas = await fetchAllRows<Row>((from, to) =>
        service.from('catalog_products').select('id, slug, name, image_url').or(filtro).order('name').range(from, to)
      );
    }

    return NextResponse.json({
      data: filas.map((p) => ({ id: p.id, slug: p.slug, name: p.name, hasImage: !!p.image_url })),
    });
  } catch (error) {
    return serverError('catalog-images/products GET', error);
  }
}
