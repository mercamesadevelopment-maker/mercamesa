import { PQRS_OUTCOME_LABELS, PQRS_STATUS_LABELS, type PqrsDetail, type PqrsSummary } from '@/lib/pqrs/types';
import type { toStorefrontItem } from '@/lib/store-products/storefront';

/**
 * Lo que sale del MCP hacia Meteor, recortado a propósito: cada vista nombra
 * los campos que entrega en vez de pasar el objeto de la app. Así un campo
 * nuevo de la app no llega al chat sin que alguien lo decida.
 */

type StorefrontItem = ReturnType<typeof toStorefrontItem>;

export function toProductView(p: StorefrontItem) {
  return {
    id: p.id,
    nombre: p.catalog_products.name,
    categoria: p.catalog_products.categories?.name ?? null,
    tienda: p.stores.name,
    tienda_id: p.store_id,
    plaza: p.stores.marketplaces?.name ?? null,
    unidad: p.measurement_units?.abbreviation ?? null,
    precio: p.price_per_unit,
    precio_oferta: p.offer ? p.offer.finalPrice : null,
    oferta: p.offer?.label ?? null,
    existencias: p.stock,
    imagen: p.imageSignedUrl,
  };
}

export function toCaseSummaryView(c: PqrsSummary) {
  return {
    codigo: c.code,
    motivo: c.reasonLabel,
    estado: c.status,
    estado_texto: PQRS_STATUS_LABELS[c.status] ?? c.status,
    resultado: c.outcome ? PQRS_OUTCOME_LABELS[c.outcome] ?? c.outcome : null,
    tienda: c.storeName,
    pedido: c.orderCode,
    creado: c.createdAt,
    actualizado: c.updatedAt,
  };
}

/**
 * El caso como lo puede leer el comprador por el chat: sin mensajes internos,
 * sin nombres de quien atendió (solo si fue la tienda o MercaMesa) y sin
 * adjuntos, que llevan enlaces firmados.
 */
export function toCaseView(c: PqrsDetail) {
  return {
    ...toCaseSummaryView(c),
    descripcion: c.description,
    productos: c.items.map((i) => ({ nombre: i.name, cantidad: i.quantity, unidad: i.unit })),
    respuesta_de_la_tienda: c.storeResponse,
    resuelto: c.resolvedAt,
    notas_de_resolucion: c.resolutionNotes,
    conversacion: c.messages
      .filter((m) => !m.isInternal)
      .map((m) => ({ de: m.authorAs, mensaje: m.body, fecha: m.createdAt })),
    devolucion: c.refund
      ? { total: c.refund.total, metodo: c.refund.method, estado: c.refund.status, pagada: c.refund.moneyPaidAt }
      : null,
  };
}

type OrderSummary = import('@/lib/orders/buyer-orders').BuyerOrderSummary;
type OrderDetail = import('@/lib/orders/buyer-orders').BuyerOrderDetail;

export function toOrderSummaryView(o: OrderSummary) {
  return {
    codigo: o.code,
    fecha: o.createdAt,
    estado: o.status,
    estado_texto: o.statusLabel,
    pago: o.paymentStatus,
    pago_texto: o.paymentStatusLabel,
    total: o.total,
    // Un pedido de varias tiendas tiene una parte por tienda, cada una con su estado.
    partes: o.parts.map((p) => ({ codigo: p.code, tienda: p.storeName, estado: p.status, estado_texto: p.statusLabel })),
  };
}

export function toOrderDetailView(o: OrderDetail) {
  return {
    ...toOrderSummaryView(o),
    valores: {
      productos: o.subtotal,
      domicilio: o.deliveryFee,
      comision_de_servicio: o.serviceCommission,
      mensajes: o.messagesAmount,
      servicio_mercamesa: o.platformCommission,
      descuento: o.discount,
      saldo_a_favor_usado: o.creditApplied,
      total: o.total,
    },
    direccion: o.deliveryAddress
      ? { municipio: o.deliveryAddress.municipality, barrio: o.deliveryAddress.neighborhood, direccion: o.deliveryAddress.addressLine }
      : null,
    partes: o.parts.map((p) => ({
      codigo: p.code,
      tienda: p.storeName,
      estado: p.status,
      estado_texto: p.statusLabel,
      productos: p.products.map((i) => ({
        nombre: i.name,
        cantidad: i.quantity,
        unidad: i.unit,
        precio_unitario: i.unitPrice,
        total: i.total,
      })),
      historial: p.history.map((h) => ({ estado: h.status, estado_texto: h.statusLabel, fecha: h.at })),
      domicilio: p.delivery
        ? {
            estado: p.delivery.statusLabel,
            conductor: p.delivery.driverName,
            placa: p.delivery.vehiclePlates,
            seguimiento: p.delivery.trackingLink,
            actualizado: p.delivery.updatedAt,
          }
        : null,
    })),
  };
}
