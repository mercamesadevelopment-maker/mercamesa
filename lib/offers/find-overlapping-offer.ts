import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Busca otra oferta del mismo producto cuyo periodo se cruce con el nuevo.
 *
 * Nada en la base lo impedía, así que un producto podía tener dos ofertas
 * vigentes a la vez. El carrito resuelve el empate tomando "la primera que
 * encuentre" (`cart.service.ts`), o sea que el precio dependía del orden en que
 * volvieran las filas. Mejor no dejar que se cree la ambigüedad.
 *
 * Solo cuentan las ofertas que pueden llegar a aplicarse: una `inactive` está
 * archivada y no estorba.
 *
 * Devuelve el mensaje de error, o `null` si no hay cruce.
 */
export async function findOverlappingOffer(
  supabase: SupabaseClient<any>,
  storeProductId: string,
  startsAt: string,
  endsAt: string | null,
  excludeOfferId?: string
): Promise<string | null> {
  let query = supabase
    .from('store_offers')
    .select('id, starts_at, ends_at, status')
    .eq('store_product_id', storeProductId)
    .in('status', ['pending', 'verified', 'active']);

  if (excludeOfferId) {
    query = query.neq('id', excludeOfferId);
  }

  const { data } = await query;
  if (!data || data.length === 0) return null;

  const newStart = new Date(startsAt).getTime();
  // Sin fecha de fin la oferta no vence nunca, así que se cruza con todo lo que
  // venga después.
  const newEnd = endsAt ? new Date(endsAt).getTime() : Number.POSITIVE_INFINITY;

  const clash = data.find((offer) => {
    const start = new Date(offer.starts_at).getTime();
    const end = offer.ends_at ? new Date(offer.ends_at).getTime() : Number.POSITIVE_INFINITY;
    return newStart <= end && start <= newEnd;
  });

  if (!clash) return null;

  const until = clash.ends_at
    ? `hasta el ${new Date(clash.ends_at).toLocaleDateString('es-CO')}`
    : 'sin fecha de fin';

  return `Este producto ya tiene otra oferta desde el ${new Date(
    clash.starts_at
  ).toLocaleDateString('es-CO')} ${until}. Ajusta las fechas o desactiva la otra oferta primero.`;
}
