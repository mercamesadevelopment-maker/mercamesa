/**
 * Catálogos de la API de Pibox (ver docs/picap.MD, sección "Estados").
 * Los identificadores son los que viaja Pibox; las etiquetas son las que
 * mostramos en el histórico de la orden y en la UI.
 */

/** Estados de un pedido (booking.status_cd) */
export const PIBOX_BOOKING_STATUS = {
  SEARCHING_DRIVER: 0,
  DRIVER_ON_THE_WAY: 1,
  PICKING_UP: 5,
  ON_BOARD: 6,
  DELIVERING: 7,
  FINISHED: 4,
  CANCELED_BY_DRIVER: 100,
  EXPIRED_NO_DRIVER: 101,
  CANCELED_BY_PASSENGER: 102,
  SCHEDULED: 109,
} as const;

export const PIBOX_BOOKING_STATUS_LABEL: Record<number, string> = {
  0: 'Buscando conductor',
  1: 'Conductor en camino',
  5: 'Recogiendo paquete',
  6: 'Paquete a bordo',
  7: 'Entregando paquete',
  4: 'Pedido finalizado',
  100: 'Cancelado por conductor',
  101: 'Expirado, no se encontró conductor',
  102: 'Cancelado por pasajero',
  109: 'Programado',
};

/** Estados de un paquete (package.status_cd) */
export const PIBOX_PACKAGE_STATUS = {
  WAITING_PICKUP: 0,
  PICKED_UP: 1,
  DELIVERED: 2,
  CANCELED: 3,
  NOT_RECEIVED: 4,
  RETURNED: 5,
  IN_WAREHOUSE: 6,
} as const;

export const PIBOX_PACKAGE_STATUS_LABEL: Record<number, string> = {
  0: 'Esperando recogida',
  1: 'Paquete recogido',
  2: 'Paquete entregado',
  3: 'Paquete cancelado',
  4: 'Paquete no recibido',
  5: 'Paquete devuelto',
  6: 'En bodega',
};

/** Razones por las cuales no se pudo recoger el paquete (canceled_pickup_reason_cd) */
export const PIBOX_PICKUP_CANCEL_REASON_LABEL: Record<number, string> = {
  0: 'Producto no disponible',
  1: 'Dirección incorrecta',
  2: 'Cerrado',
};

/** Razones por las cuales no se pudo entregar el paquete (not_received_reason_cd) */
export const PIBOX_NOT_RECEIVED_REASON_LABEL: Record<number, string> = {
  0: 'Ninguno',
  1: 'Dirección incorrecta',
  2: 'Rechazado por el cliente',
  3: 'Cliente ausente',
  4: 'Cliente no tiene dinero',
};

/** Tamaños de paquete (size_cd) */
export const PIBOX_PACKAGE_SIZE_LABEL: Record<number, string> = {
  0: 'Muy pequeño (documentos, llaves)',
  1: 'Pequeño (20x20x20 cm)',
  2: 'Mediano (30x30x30 cm)',
  3: 'Grande (50x50x50 cm)',
};

/** Eventos a los que se puede suscribir un webhook (event_cd) */
export const PIBOX_WEBHOOK_EVENT = {
  BOOKING_UPDATED: 0,
  PACKAGE_UPDATED: 1,
  PREPACKAGE_UPDATED: 2,
} as const;

/**
 * Códigos de ciudad soportados por el geocoder de Pibox, usados solo cuando
 * una dirección no tiene coordenadas guardadas.
 */
export const PIBOX_CITY_CODES = [
  'bogota',
  'medellin',
  'barranquilla',
  'cali',
  'bucaramanga',
  'guatemala',
] as const;

export type PiboxCityCode = (typeof PIBOX_CITY_CODES)[number];

/**
 * Normaliza el nombre de un municipio a un city_code de Pibox
 * (quita tildes y espacios). Devuelve null si la ciudad no está soportada.
 */
export function toPiboxCityCode(municipality: string | null | undefined): PiboxCityCode | null {
  if (!municipality) return null;
  const normalized = municipality
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  return (PIBOX_CITY_CODES as readonly string[]).includes(normalized)
    ? (normalized as PiboxCityCode)
    : null;
}

/** Pibox maneja el dinero en centavos: $9.200 COP viaja como 920000. */
export function toSubUnits(amount: number): number {
  return Math.round(Number(amount) * 100);
}

/** Inverso de toSubUnits: convierte los centavos de Pibox a pesos. */
export function fromSubUnits(subUnits: number | null | undefined): number | null {
  if (subUnits === null || subUnits === undefined) return null;
  return Number(subUnits) / 100;
}
