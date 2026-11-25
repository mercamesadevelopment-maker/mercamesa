import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadProductDetail } from '@/lib/store-products/product-detail';
import { ProductDetailView } from '@/features/products/components/detail/ProductDetailView';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Props = { params: Promise<{ id: string }> };

/** Un id que no es uuid haría fallar la consulta: es un 404, no un error. */
async function cargar(id: string) {
  if (!UUID.test(id)) return null;
  try {
    return await loadProductDetail(await createClient(), id);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await cargar((await params).id);
  if (!product) return { title: 'Producto no encontrado · MercaMesa' };
  return {
    title: `${product.catalog_products.name} · ${product.store.name} · MercaMesa`,
    description: product.description ?? undefined,
  };
}

/** La página de un producto de la vitrina (`store_products.id`). */
export default async function ProductPage({ params }: Props) {
  const product = await cargar((await params).id);
  if (!product) notFound();
  return <ProductDetailView product={product} />;
}
