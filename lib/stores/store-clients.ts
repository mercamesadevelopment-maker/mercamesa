import type { OrderItem } from '@/src/types';
import { formatOrderCode } from '@/src/features/orders/utils/orderCode';

/**
 * Los clientes de una o varias tiendas, armados desde sus pedidos.
 *
 * Un cliente es quien compró: el cliente de mostrador (`orders.client_id`) o,
 * en una compra en línea, el comprador con cuenta (`orders.buyer_id`). Antes la
 * pantalla solo listaba la tabla `clients`, que llena la venta de mostrador, y
 * descartaba todo pedido sin `client_id`: ningún comprador en línea aparecía.
 */

export interface ClientOrder {
  id: string; // código legible del pedido, e.g. "MM-2026-001017-1"
  rawId: string;
  date: string;
  total: number;
  status: string;
  paymentStatus: string;
  type: 'online' | 'local';
  storeName: string;
  items: OrderItem[];
}

export interface ClientWithMetrics {
  id: string;
  full_name: string;
  document_number: string;
  /** Código del tipo de identificación ("CC", "NIT"). Null si no lo tiene. */
  identification_code: string | null;
  email: string | null;
  phone: string | null;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate: string | null;
  /** Tiendas donde compró, sin repetir. */
  storeNames: string[];
  orders: ClientOrder[];
}

/** Una parte de pedido (`store_orders`) con lo que hace falta del pedido. */
export interface ClientOrderPart {
  id: string;
  order_id: string;
  store_id: string;
  code: string | null;
  subtotal: number | string | null;
  status: string | null;
  created_at: string;
  orders: {
    buyer_id: string | null;
    client_id: string | null;
    payment_status: string | null;
  } | null;
}

export interface ClientOrderItem {
  id: string;
  order_id: string;
  quantity: number | string;
  unit_price: number | string;
  catalog_name: string | null;
  unit_name: string | null;
  store_products: { store_id: string } | null;
}

/** Los datos de una persona, venga de `clients` o de `profiles`. */
export interface ClientPerson {
  id: string;
  full_name: string | null;
  document_number: string | null;
  email: string | null;
  phone: string | null;
  identification_types: { code: string | null } | null;
  /** Solo en `clients`: el comprador con cuenta que es este cliente. */
  profile_id?: string | null;
}

export interface GroupStoreClientsInput {
  parts: ClientOrderPart[];
  items: ClientOrderItem[];
  /** Clientes de mostrador. Los que no tienen pedidos en `parts` salen con cero compras. */
  clients: ClientPerson[];
  /** Compradores con cuenta. */
  profiles: ClientPerson[];
  storeNames: Record<string, string>;
}

const STATUS_LABELS: Record<string, string> = {
  delivered: 'Entregado',
  pending: 'Pendiente',
  cancelled: 'Cancelado',
  returned: 'Devuelto',
};

export function groupStoreClients({
  parts,
  items,
  clients,
  profiles,
  storeNames,
}: GroupStoreClientsInput): ClientWithMetrics[] {
  const people = new Map<string, ClientWithMetrics>();
  // Un cliente de mostrador ligado a una cuenta es la misma persona que ese
  // comprador: sus pedidos van juntos, con la ficha del cliente.
  const personByProfile = new Map<string, string>();

  for (const client of clients) {
    people.set(client.id, toPerson(client));
    if (client.profile_id) personByProfile.set(client.profile_id, client.id);
  }
  for (const profile of profiles) {
    if (personByProfile.has(profile.id)) continue;
    people.set(profile.id, toPerson(profile));
    personByProfile.set(profile.id, profile.id);
  }

  for (const part of parts) {
    const order = part.orders;
    const personId = order?.client_id ?? (order?.buyer_id ? personByProfile.get(order.buyer_id) : undefined);
    const person = personId ? people.get(personId) : undefined;
    if (!person) continue;

    const storeName = storeNames[part.store_id] ?? 'Tienda';
    person.orders.push({
      id: formatOrderCode(part.code, part.id),
      rawId: part.id,
      date: part.created_at,
      total: Number(part.subtotal ?? 0),
      status: STATUS_LABELS[part.status ?? ''] ?? 'Confirmado',
      paymentStatus: order?.payment_status === 'approved' ? 'Pagado' : 'Pendiente',
      type: order?.client_id ? 'local' : 'online',
      storeName,
      // Solo los productos de esta tienda: un pedido de varias tiendas trae
      // también los de las otras.
      items: items
        .filter((item) => item.order_id === part.order_id && item.store_products?.store_id === part.store_id)
        .map((item) => ({
          id: item.id,
          name: item.catalog_name || 'Producto',
          qty: Number(item.quantity),
          price: Number(item.unit_price),
          unit: item.unit_name || 'unid',
          emoji: getEmojiForName(item.catalog_name),
        })),
    });
  }

  return [...people.values()]
    .map((person) => {
      const orders = [...person.orders].sort((a, b) => b.date.localeCompare(a.date));
      return {
        ...person,
        orders,
        totalOrders: orders.length,
        // Solo lo que de verdad se pagó: una compra en línea que venció sin pagar
        // o se canceló sigue en el historial, pero no suma.
        totalSpent: orders.filter(countsAsSpent).reduce((sum, o) => sum + o.total, 0),
        lastOrderDate: orders[0]?.date ?? null,
        storeNames: [...new Set(orders.map((o) => o.storeName))],
      };
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name, 'es'));
}

function countsAsSpent(order: ClientOrder): boolean {
  return order.paymentStatus === 'Pagado' && order.status !== 'Cancelado' && order.status !== 'Devuelto';
}

function toPerson(row: ClientPerson): ClientWithMetrics {
  return {
    id: row.id,
    full_name: row.full_name?.trim() || 'Sin nombre',
    document_number: row.document_number || '',
    identification_code: row.identification_types?.code ?? null,
    email: row.email,
    phone: row.phone,
    totalOrders: 0,
    totalSpent: 0,
    lastOrderDate: null,
    storeNames: [],
    orders: [],
  };
}

function getEmojiForName(name?: string | null): string {
  if (!name) return '📦';
  const n = name.toLowerCase();
  if (n.includes('tomate')) return '🍅';
  if (n.includes('limón') || n.includes('limon')) return '🍋';
  if (n.includes('zanahoria')) return '🥕';
  if (n.includes('papa')) return '🥔';
  if (n.includes('maíz') || n.includes('maiz')) return '🌽';
  if (n.includes('ají') || n.includes('aji')) return '🌶️';
  if (n.includes('ajo')) return '🧄';
  if (n.includes('cebolla')) return '🧅';
  if (n.includes('carne') || n.includes('res') || n.includes('punta')) return '🥩';
  if (n.includes('banano') || n.includes('plátano')) return '🍌';
  if (n.includes('manzana')) return '🍎';
  if (n.includes('cilantro')) return '🥬';
  return '📦';
}
