import type { BuyerOrderDetail } from '@/lib/orders/buyer-orders';
import { ORDER_STATUS_LABELS } from '@/lib/orders/status-labels';
import { toOrderDetailView } from '@/lib/mcp/views';
import { avisoId, lineaFor, type EventRow, type Recipient } from './rules';
import type { PickupRecipient } from './recipients';

/** Lo que se lee de la reserva de Pibox para los avisos con código. */
export interface BookingCodes {
  pickup_validation_code: string | null;
  validation_code: string | null;
  driver_name: string | null;
  vehicle_plates: string | null;
}

/**
 * Un aviso tal como lo recibe Meteor, para llenar su plantilla de WhatsApp.
 *
 * El pedido sale por la misma vista del MCP (`toOrderDetailView`), que nombra
 * campo por campo lo que se entrega: sin los códigos del domicilio y sin el
 * teléfono del conductor. Se le quita el historial de estados, que no hace falta
 * para un mensaje.
 *
 * El único código que lleva un aviso del comprador es el suyo, el de entrega, y
 * solo en `domicilio_recogido`: cuando el mensajero ya va hacia él.
 */
export function toAviso(
  ev: EventRow,
  detail: BuyerOrderDetail,
  recipient: Recipient,
  partCode: string | null,
  booking: BookingCodes | null = null
) {
  const pedido = toOrderDetailView(detail);
  const partes = pedido.partes.map(({ historial: _historial, ...p }) => p);
  const parte = partCode ? partes.find((p) => p.codigo === partCode) ?? null : null;
  // Un domicilio consolidado es del pedido completo y aparece en todas sus partes.
  const conDomicilio = ev.event_type === 'domicilio_en_camino' || ev.event_type === 'domicilio_recogido';
  const domicilio = conDomicilio ? (parte ?? partes.find((p) => p.domicilio))?.domicilio ?? null : null;

  return {
    id: ev.id,
    seq: Number(ev.seq),
    tipo: ev.event_type,
    // Desde qué línea de Meteor se escribe.
    linea: lineaFor('comprador'),
    ocurrio_en: ev.created_at,
    estado_nuevo: ev.status_to ? { estado: ev.status_to, estado_texto: ORDER_STATUS_LABELS[ev.status_to] ?? ev.status_to } : null,
    parte: parte ? { codigo: parte.codigo, tienda: parte.tienda } : null,
    destinatario: { telefono: recipient.phone, nombre: recipient.full_name ?? '', rol: 'comprador' as const },
    pedido: { ...pedido, partes },
    domicilio: domicilio
      ? {
          seguimiento: domicilio.seguimiento,
          conductor: domicilio.conductor,
          placa: domicilio.placa,
          estado: domicilio.estado,
          ...(ev.event_type === 'domicilio_recogido' ? { codigo_entrega: booking?.validation_code ?? null } : {}),
        }
      : null,
  };
}

export interface PickupContext {
  orderCode: string;
  /** La parte de la reserva; `null` si el pedido sale consolidado de la bahía. */
  part: { codigo: string; tienda: string } | null;
  /** Las tiendas cuyo paquete recoge el mensajero. */
  tiendas: string[];
  booking: BookingCodes;
}

/**
 * El código de recogida, para quien le entrega el paquete al mensajero: la
 * tienda, o logística o el patinador en la bahía de la plaza. Un aviso por
 * persona. No lleva nada del comprador (ni dirección ni valores) ni su código
 * de entrega.
 */
export function toPickupCodeAviso(ev: EventRow, recipient: PickupRecipient, ctx: PickupContext) {
  return {
    id: avisoId(ev.id, recipient.id),
    seq: Number(ev.seq),
    tipo: ev.event_type,
    linea: lineaFor(recipient.rol),
    ocurrio_en: ev.created_at,
    destinatario: { telefono: recipient.phone, nombre: recipient.full_name ?? '', rol: recipient.rol },
    pedido: { codigo: ctx.orderCode },
    parte: ctx.part,
    tiendas: ctx.tiendas,
    recogida: {
      codigo: ctx.booking.pickup_validation_code,
      conductor: ctx.booking.driver_name,
      placa: ctx.booking.vehicle_plates,
      lugar: ctx.part ? ('tienda' as const) : ('bahia' as const),
    },
  };
}

export type Aviso = ReturnType<typeof toAviso> | ReturnType<typeof toPickupCodeAviso>;
