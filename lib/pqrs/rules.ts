import type { PqrsReason } from './reasons';
import type { PqrsOrderContext } from './types';

/**
 * Las reglas para radicar. Funciones puras: no tocan red ni base, así que el
 * formulario y el servidor dicen exactamente lo mismo.
 */

const HORA = 60 * 60 * 1000;

/** Hasta cuándo se puede reclamar por el estado de un pedido entregado. */
export function claimDeadline(deliveredAt: string, claimWindowHours: number): Date {
  return new Date(new Date(deliveredAt).getTime() + claimWindowHours * HORA);
}

/**
 * Por qué este motivo no aplica a este pedido, o `null` si aplica.
 *
 * El mensaje es para quien radica: dice qué pasa y, cuando se puede, qué hacer.
 */
export function whyReasonUnavailable(
  reason: PqrsReason,
  order: PqrsOrderContext | null,
  claimWindowHours: number,
  now: Date = new Date()
): string | null {
  if (!order) {
    return reason.order === 'required' ? 'Elige el pedido del que quieres hablar.' : null;
  }

  if (reason.order === 'none') return null;

  if (reason.orderStatuses && !reason.orderStatuses.includes(order.status)) {
    return reason.orderStatuses.length === 1 && reason.orderStatuses[0] === 'delivered'
      ? 'Solo aplica a pedidos ya entregados.'
      : 'No aplica al estado en que está este pedido.';
  }

  if (reason.requiresPaid && !order.paid) {
    return 'Este pedido no tiene un pago aprobado.';
  }

  if (reason.claimWindow) {
    // Sin la fecha de entrega no se puede saber si el plazo ya pasó. Se deja
    // radicar: negarle el reclamo al comprador por un dato que nos falta a
    // nosotros sería peor, y el caso lo revisa una persona de todos modos.
    if (order.deliveredAt && now > claimDeadline(order.deliveredAt, claimWindowHours)) {
      return `El plazo para este reclamo es de ${claimWindowHours} horas desde la entrega y ya pasó. Si aun así necesitas ayuda, radica una petición.`;
    }
  }

  return null;
}

export interface NewPqrsCheck {
  reason: PqrsReason;
  order: PqrsOrderContext | null;
  description: string;
  items: { orderItemId: string; quantity: number }[];
  photos: number;
  claimWindowHours: number;
}

export const MIN_DESCRIPTION = 15;
export const MAX_DESCRIPTION = 2000;
export const MAX_PHOTOS = 5;

/** El primer problema de una radicación, o `null` si está completa. */
export function validateNewPqrs(check: NewPqrsCheck): string | null {
  const { reason, order, items } = check;

  const descripcion = check.description.trim();
  if (descripcion.length < MIN_DESCRIPTION) {
    return `Cuéntanos un poco más: la descripción debe tener al menos ${MIN_DESCRIPTION} caracteres.`;
  }
  if (descripcion.length > MAX_DESCRIPTION) {
    return `La descripción no puede pasar de ${MAX_DESCRIPTION} caracteres.`;
  }

  const noAplica = whyReasonUnavailable(reason, order, check.claimWindowHours);
  if (noAplica) return noAplica;

  if (reason.items === 'required' && items.length === 0) {
    return 'Marca al menos un producto del pedido.';
  }

  if (items.length > 0) {
    if (reason.items === 'none' || !order) return 'Este motivo no lleva productos.';

    for (const item of items) {
      const linea = order.items.find((i) => i.id === item.orderItemId);
      if (!linea) return 'Uno de los productos marcados no es de este pedido.';
      if (!(item.quantity > 0) || item.quantity > linea.quantity) {
        return `La cantidad de «${linea.name}» debe estar entre 0 y ${linea.quantity}.`;
      }
    }
  }

  if (check.photos > MAX_PHOTOS) return `Puedes adjuntar hasta ${MAX_PHOTOS} fotos.`;
  if (reason.photo && check.photos === 0) return 'Este motivo necesita al menos una foto.';

  return null;
}
