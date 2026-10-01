import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveOfferPrices } from '@/lib/offers/resolve-offer-prices';
import { isBuyerBlocked } from '@/lib/stores/buyer-blocks';
import { MIXED_PICKUP_MESSAGE, sharePickupPoint } from './pickup-group';

/**
 * Lo que un pedido es, antes de cobrarlo: qué productos, a qué precio y de qué
 * tiendas.
 *
 * La cotización del carrito y la creación del pedido hacían esta misma cuenta
 * cada una por su lado, y cada una asumía una sola tienda. Vive acá una vez
 * para que lo que el comprador ve cotizado sea lo que después se guarda.
 *
 * Nada de lo que decide el precio o el reparto entre tiendas viene del
 * navegador: de él solo se toma qué productos y cuántos. Las tiendas del pedido
 * salen de los productos, no de una lista que mande el cliente.
 */

/** Un motivo para no seguir, con el código HTTP que le corresponde. */
export class OrderDraftError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly extra?: Record<string, unknown>;

  constructor(message: string, status = 400, code?: string, extra?: Record<string, unknown>) {
    super(message);
    this.name = 'OrderDraftError';
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export interface DraftItemInput {
  store_product_id: string;
  quantity: number;
  notes?: string | null;
  catalog_name?: string;
  unit_name?: string;
}

export interface DraftItem {
  store_product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  catalog_name: string;
  unit_name: string;
  notes: string | null;
}

/** La parte del pedido que le toca a una tienda. Será un `store_orders`. */
export interface DraftStorePart {
  storeId: string;
  storeName: string;
  subtotal: number;
}

export interface OrderDraft {
  isWholesale: boolean;
  items: DraftItem[];
  /** Una por tienda, en el orden en que aparecen sus productos. */
  storeParts: DraftStorePart[];
  productsSubtotal: number;
  /** A precio de lista, para mostrar el ahorro de las ofertas. */
  productsListSubtotal: number;
}

export interface BuildDraftOptions {
  /** De quién se lee el tipo de comprador (minorista o mayorista). */
  buyerProfileId: string;
  /**
   * Comprador al que se le comprueban los bloqueos. Se omite en mostrador: ahí
   * quien registra la venta es la tienda.
   */
  blockedBuyerId?: string;
  /** Exige existencias suficientes. La cotización no lo hace: solo muestra precios. */
  checkStock?: boolean;
}

export async function buildOrderDraft(
  supabase: SupabaseClient<any>,
  service: SupabaseClient<any>,
  items: DraftItemInput[],
  options: BuildDraftOptions
): Promise<OrderDraft> {
  if (items.length === 0) {
    throw new OrderDraftError('El pedido debe contener al menos un producto');
  }

  // Tipo de comprador desde la base, nunca desde el navegador: define si aplica
  // el precio mayorista.
  const { data: profile } = await supabase
    .from('profiles')
    .select('buyer_type')
    .eq('id', options.buyerProfileId)
    .single();
  const isWholesale = profile?.buyer_type === 'wholesale';

  const productIds = items.map((i) => i.store_product_id);
  const { data: dbProducts, error: productsError } = await supabase
    .from('store_products')
    .select(
      `id, price_per_unit, wholesale_price, store_id, stock,
       catalog_products ( name ),
       measurement_units ( abbreviation ),
       stores ( name, pickup_group )`
    )
    .in('id', productIds);

  if (productsError || !dbProducts) {
    throw new OrderDraftError(productsError?.message || 'Error al verificar los productos');
  }
  if (dbProducts.length !== new Set(productIds).size) {
    throw new OrderDraftError('Uno o más productos del pedido no son válidos');
  }

  const porId = new Map<string, any>((dbProducts as any[]).map((p) => [String(p.id), p]));

  // Las ofertas vigentes las resuelve el servidor, igual que el precio.
  const precios = await resolveOfferPrices(supabase, dbProducts as any[], isWholesale);

  let productsSubtotal = 0;
  let productsListSubtotal = 0;
  const partes = new Map<string, DraftStorePart>();

  const draftItems: DraftItem[] = items.map((item) => {
    const producto = porId.get(String(item.store_product_id));
    const precio = precios.get(item.store_product_id);
    if (!producto || !precio) {
      throw new OrderDraftError('Uno o más productos del pedido no son válidos');
    }

    const quantity = Number(item.quantity);
    const totalPrice = precio.finalPrice * quantity;
    productsSubtotal += totalPrice;
    productsListSubtotal += precio.listPrice * quantity;

    const storeId = String(producto.store_id);
    const parte = partes.get(storeId);
    if (parte) parte.subtotal += totalPrice;
    else partes.set(storeId, { storeId, storeName: producto.stores?.name ?? 'Tienda', subtotal: totalPrice });

    return {
      store_product_id: item.store_product_id,
      quantity,
      unit_price: precio.finalPrice,
      total_price: totalPrice,
      catalog_name: producto.catalog_products?.name || item.catalog_name || 'Producto',
      unit_name: producto.measurement_units?.abbreviation || item.unit_name || 'und',
      notes: item.notes || null,
    };
  });

  const storeParts = Array.from(partes.values());

  // Varias tiendas solo si despachan desde el mismo punto: de ahí sale un solo
  // domicilio. El carrito ya lo avisa al agregar; acá es donde se decide.
  if (storeParts.length > 1) {
    const grupos = storeParts.map(
      (p) => (dbProducts as any[]).find((x) => String(x.store_id) === p.storeId)?.stores?.pickup_group
    );
    if (!sharePickupPoint(grupos)) {
      throw new OrderDraftError(MIXED_PICKUP_MESSAGE, 400, 'mixed_pickup');
    }
  }

  // Un comprador bloqueado en cualquiera de las tiendas no pasa. Se dice en
  // cuál, para que sepa qué quitar de la canasta.
  if (options.blockedBuyerId) {
    for (const parte of storeParts) {
      if (await isBuyerBlocked(service, parte.storeId, options.blockedBuyerId)) {
        throw new OrderDraftError(
          `${parte.storeName} no está recibiendo pedidos de tu cuenta. Puedes comprar en las demás tiendas; si crees que es un error, escríbenos desde «PQRS».`,
          403,
          'buyer_blocked',
          { storeId: parte.storeId }
        );
      }
    }
  }

  if (options.checkStock) {
    const outOfStock = draftItems
      .map((item) => ({
        name: item.catalog_name,
        unit: item.unit_name,
        requested: item.quantity,
        available: Number(porId.get(String(item.store_product_id))?.stock ?? 0),
      }))
      .filter((l) => l.requested > l.available);

    if (outOfStock.length > 0) {
      const detalle = outOfStock
        .map((l) =>
          l.available <= 0
            ? `${l.name} (sin existencias)`
            : `${l.name} (quedan ${l.available} ${l.unit || ''})`.trim()
        )
        .join(', ');

      throw new OrderDraftError(
        `No hay existencias suficientes de: ${detalle}. Ajusta las cantidades e intenta de nuevo.`,
        409,
        'out_of_stock',
        { outOfStock }
      );
    }
  }

  return { isWholesale, items: draftItems, storeParts, productsSubtotal, productsListSubtotal };
}

/**
 * El mínimo de compra, medido sobre el pedido completo.
 *
 * Con una sola tienda por pedido daba igual decir «por tienda» o «por pedido».
 * Con varias no: el mínimo existe para que valga la pena despachar un domicilio,
 * y el domicilio es uno por pedido. Lanza si no se alcanza.
 */
export async function assertMinimumPurchase(supabase: SupabaseClient<any>, draft: OrderDraft): Promise<void> {
  const { data: minPriceRow } = await supabase
    .from('order_min_price_history')
    .select('min_price')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!minPriceRow) return;

  const minimo = Number(minPriceRow.min_price);
  if (draft.productsSubtotal >= minimo) return;

  const faltante = minimo - draft.productsSubtotal;
  throw new OrderDraftError(
    `Te faltan $${faltante.toLocaleString('es-CO')} para el mínimo de compra de $${minimo.toLocaleString('es-CO')}.`,
    400,
    'below_minimum'
  );
}
