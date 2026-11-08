import type { BuyerOrderDetail } from '@/lib/orders/buyer-orders';
import { ORDER_STATUS_LABELS } from '@/lib/orders/status-labels';
import { toOrderDetailView } from '@/lib/mcp/views';
import type { EventRow, Recipient } from './rules';

/**
 * Un aviso tal como lo recibe Meteor, para llenar su plantilla de WhatsApp.
 *
 * El pedido sale por la misma vista del MCP (`toOrderDetailView`), que nombra
 * campo por campo lo que se entrega: sin los códigos de entrega o de recogida
 * del domicilio y sin el teléfono del conductor. Se le quita el historial de
 * estados, que no hace falta para un mensaje.
 */
export function toAviso(
  ev: EventRow,
  detail: BuyerOrderDetail,
  recipient: Recipient,
  partCode: string | null
) {
  const pedido = toOrderDetailView(detail);
  const partes = pedido.partes.map(({ historial: _historial, ...p }) => p);
  const parte = partCode ? partes.find((p) => p.codigo === partCode) ?? null : null;
  // Un domicilio consolidado es del pedido completo y aparece en todas sus partes.
  const domicilio =
    ev.event_type === 'domicilio_en_camino' ? (parte ?? partes.find((p) => p.domicilio))?.domicilio ?? null : null;

  return {
    id: ev.id,
    seq: Number(ev.seq),
    tipo: ev.event_type,
    // Desde qué línea de Meteor se escribe. Hoy todos los avisos son para compradores.
    linea: 'compradores' as const,
    ocurrio_en: ev.created_at,
    estado_nuevo: ev.status_to ? { estado: ev.status_to, estado_texto: ORDER_STATUS_LABELS[ev.status_to] ?? ev.status_to } : null,
    parte: parte ? { codigo: parte.codigo, tienda: parte.tienda } : null,
    destinatario: { telefono: recipient.phone, nombre: recipient.full_name ?? '' },
    pedido: { ...pedido, partes },
    domicilio: domicilio
      ? { seguimiento: domicilio.seguimiento, conductor: domicilio.conductor, placa: domicilio.placa, estado: domicilio.estado }
      : null,
  };
}

export type Aviso = ReturnType<typeof toAviso>;
