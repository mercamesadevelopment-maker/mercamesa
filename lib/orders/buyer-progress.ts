import type { Database } from '@/types/database_generated';
import type { DeliveryStage, DeliveryView } from '@/lib/pibox/delivery-view';

type OrderStatus = Database['public']['Enums']['order_status'];

/**
 * En qué va el pedido, dicho para el comprador: una frase grande y la barra de
 * cuatro pasos del detalle del pedido (`features/orders/components/buyer/BuyerOrderHero`).
 *
 * Junta el estado del pedido con el del domicilio de Picap, que va más
 * adelantado: el pedido sigue «listo para recoger» mientras el domiciliario va
 * por él.
 */

export const BUYER_STEPS = ['Confirmado', 'Preparando', 'En camino', 'Entregado'] as const;

export type BuyerProgressTone =
  /** Avanza: se pinta la barra. */
  | 'active'
  | 'done'
  /** Hay que hacer algo (pagar). */
  | 'action'
  /** Se cerró sin entregarse: cancelado, devuelto o vencido. */
  | 'closed';

export interface BuyerProgress {
  title: string;
  detail: string | null;
  /** Índice en `BUYER_STEPS`, o `null` si no aplica la barra. */
  step: number | null;
  tone: BuyerProgressTone;
}

type Driver = DeliveryView['driver'];

function quienLleva(driver: Driver): string | null {
  if (!driver?.name) return null;
  return driver.plates ? `${driver.name} · placa ${driver.plates}` : driver.name;
}

export function buyerOrderProgress(
  status: OrderStatus | null | undefined,
  delivery: { stage: DeliveryStage; driver: Driver } | null,
  opts: { payable: boolean }
): BuyerProgress {
  const stage = delivery?.stage ?? null;
  const conductor = quienLleva(delivery?.driver ?? null);

  switch (status) {
    case 'pending':
      return opts.payable
        ? { title: 'Falta pagar tu pedido', detail: 'Cuando se confirme el pago, la tienda empieza a prepararlo.', step: null, tone: 'action' }
        : { title: 'Este pedido no se pagó a tiempo', detail: 'Si todavía lo quieres, haz uno nuevo.', step: null, tone: 'closed' };
    case 'confirmed':
    case 'paid':
      return { title: 'Tu pedido está confirmado', detail: 'La tienda empezará a prepararlo pronto.', step: 0, tone: 'active' };
    case 'packing':
      return { title: 'La tienda está preparando tu pedido', detail: 'Te avisaremos cuando salga.', step: 1, tone: 'active' };
    case 'at_collection':
      if (stage === 'assigned' || stage === 'picking_up') {
        return { title: 'El domiciliario va por tu pedido', detail: conductor, step: 2, tone: 'active' };
      }
      if (stage === 'on_the_way') {
        return { title: 'Tu pedido va en camino', detail: conductor, step: 2, tone: 'active' };
      }
      return { title: 'Tu pedido está listo', detail: 'Estamos buscando un domiciliario.', step: 1, tone: 'active' };
    case 'dispatched':
      return { title: 'Tu pedido va en camino', detail: conductor, step: 2, tone: 'active' };
    case 'delivered':
      return { title: 'Tu pedido fue entregado', detail: '¡Que lo disfrutes!', step: 3, tone: 'done' };
    case 'cancelled':
      return { title: 'Este pedido se canceló', detail: null, step: null, tone: 'closed' };
    case 'returned':
      return { title: 'Este pedido fue devuelto', detail: null, step: null, tone: 'closed' };
    default:
      return { title: 'Estado desconocido', detail: null, step: null, tone: 'closed' };
  }
}
