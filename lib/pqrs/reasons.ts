/**
 * El catálogo de motivos de una PQRS.
 *
 * Es la única fuente: de acá salen el formulario (qué pide cada motivo), las
 * reglas del servidor (quién puede radicar qué y cuándo) y el reparto del caso
 * (si responde primero la tienda o va directo a MercaMesa).
 *
 * Vive en código y no en una tabla porque cada motivo trae reglas, no solo un
 * nombre: agregar uno es una decisión de negocio que se revisa, no un dato que
 * alguien edita.
 */

export type PqrsKind = 'peticion' | 'queja' | 'reclamo' | 'sugerencia';
export type PqrsOpener = 'buyer' | 'seller';
export type PqrsLiable = 'store' | 'logistics' | 'platform' | 'buyer';
type Requirement = 'none' | 'optional' | 'required';

export interface PqrsReason {
  key: string;
  label: string;
  /** Una línea que le dice a quien radica qué esperar. */
  help: string;
  kind: PqrsKind;
  openedBy: PqrsOpener;
  /** ¿Hay que decir de qué pedido se habla? */
  order: Requirement;
  /** ¿Hay que marcar los productos del pedido? */
  items: Requirement;
  /** ¿La foto es obligatoria? */
  photo: boolean;
  /** Estados del pedido en los que el motivo tiene sentido. Sin lista, cualquiera. */
  orderStatuses?: string[];
  /** Solo dentro del plazo de reclamo, contado desde la entrega. */
  claimWindow: boolean;
  /** El pedido tiene que estar pagado: es un reclamo sobre plata. */
  requiresPaid: boolean;
  /** La tienda responde primero; si acepta, queda aprobado. */
  routesToStore: boolean;
  /** La tienda ve el caso y puede escribir en él. */
  storeSees: boolean;
  /** A quién se le carga el costo si se aprueba. El admin puede cambiarlo. */
  defaultLiable: PqrsLiable | null;
  /**
   * Qué se le devuelve al comprador cuando se aprueba: los productos marcados,
   * el pedido completo (con domicilio) o nada. El admin puede cambiarlo.
   */
  refund: 'items' | 'order' | 'none';
}

/** Un reclamo por el estado de lo que llegó: mismo molde para todos. */
function reclamoDeProducto(
  parcial: Pick<PqrsReason, 'key' | 'label' | 'help'> & Partial<PqrsReason>
): PqrsReason {
  return {
    kind: 'reclamo',
    openedBy: 'buyer',
    order: 'required',
    items: 'required',
    photo: true,
    orderStatuses: ['delivered'],
    claimWindow: true,
    requiresPaid: true,
    routesToStore: true,
    storeSees: true,
    defaultLiable: 'store',
    refund: 'items',
    ...parcial,
  };
}

export const PQRS_REASONS: PqrsReason[] = [
  // --- Comprador ---------------------------------------------------------
  reclamoDeProducto({
    key: 'producto_mal_estado',
    label: 'Producto en mal estado, dañado o vencido',
    help: 'Marca los productos y adjunta una foto donde se vea el problema.',
  }),
  reclamoDeProducto({
    key: 'cadena_de_frio',
    label: 'Producto refrigerado que llegó sin frío',
    help: 'Marca los productos y adjunta una foto de cómo llegaron.',
  }),
  reclamoDeProducto({
    key: 'producto_faltante',
    label: 'Me faltó un producto',
    help: 'Marca lo que no llegó y la cantidad que faltó.',
    photo: false,
  }),
  reclamoDeProducto({
    key: 'producto_equivocado',
    label: 'Me llegó un producto distinto al que pedí',
    help: 'Marca el producto que pediste y adjunta una foto de lo que llegó.',
  }),
  reclamoDeProducto({
    key: 'peso_menor',
    label: 'Llegó menos peso o cantidad de lo que pagué',
    help: 'Marca el producto, indica cuánto faltó y adjunta una foto (si puedes, en una báscula).',
  }),
  reclamoDeProducto({
    key: 'calidad_distinta',
    label: 'La calidad o la madurez no es la esperada',
    help: 'Cuéntanos qué esperabas y adjunta una foto.',
    kind: 'queja',
  }),
  reclamoDeProducto({
    key: 'maltrato_en_transporte',
    label: 'El pedido llegó maltratado por el transporte',
    help: 'Marca lo que se dañó y adjunta una foto del paquete como llegó.',
    // No es culpa de la tienda: lo revisa MercaMesa directamente.
    routesToStore: false,
    storeSees: false,
    defaultLiable: 'logistics',
  }),
  {
    key: 'pedido_no_llego',
    label: 'El pedido no llegó o llegó muy tarde',
    help: 'Cuéntanos qué pasó. Revisamos la entrega con el operador logístico.',
    kind: 'reclamo',
    openedBy: 'buyer',
    order: 'required',
    items: 'none',
    photo: false,
    orderStatuses: ['confirmed', 'paid', 'packing', 'at_collection', 'dispatched', 'delivered'],
    claimWindow: false,
    requiresPaid: true,
    routesToStore: false,
    storeSees: true,
    defaultLiable: 'logistics',
    refund: 'order',
  },
  {
    key: 'cobro_incorrecto',
    label: 'Me cobraron dos veces o un valor que no es',
    help: 'Indica el pedido si lo hay y adjunta el comprobante del cobro.',
    kind: 'reclamo',
    openedBy: 'buyer',
    order: 'optional',
    items: 'none',
    photo: false,
    claimWindow: false,
    requiresPaid: false,
    routesToStore: false,
    storeSees: false,
    defaultLiable: 'platform',
    refund: 'none',
  },
  {
    key: 'mala_atencion',
    label: 'Mala atención de la tienda o del domiciliario',
    help: 'Cuéntanos qué pasó. Esta queja la revisa MercaMesa.',
    kind: 'queja',
    openedBy: 'buyer',
    order: 'optional',
    items: 'none',
    photo: false,
    claimWindow: false,
    requiresPaid: false,
    routesToStore: false,
    storeSees: false,
    defaultLiable: null,
    refund: 'none',
  },
  {
    key: 'peticion',
    label: 'Petición (factura, datos personales, mi cuenta)',
    help: 'Dinos qué necesitas y te respondemos.',
    kind: 'peticion',
    openedBy: 'buyer',
    order: 'optional',
    items: 'none',
    photo: false,
    claimWindow: false,
    requiresPaid: false,
    routesToStore: false,
    storeSees: false,
    defaultLiable: null,
    refund: 'none',
  },
  {
    key: 'sugerencia',
    label: 'Sugerencia',
    help: 'Toda idea para mejorar MercaMesa es bienvenida.',
    kind: 'sugerencia',
    openedBy: 'buyer',
    order: 'none',
    items: 'none',
    photo: false,
    claimWindow: false,
    requiresPaid: false,
    routesToStore: false,
    storeSees: false,
    defaultLiable: null,
    refund: 'none',
  },

  // --- Tendero -----------------------------------------------------------
  {
    key: 'bloquear_comprador',
    label: 'Solicitar que un comprador no pueda comprar en mi tienda',
    help: 'Elige un pedido de ese comprador y cuéntanos por qué: pedidos que cancela, direcciones falsas, etc.',
    kind: 'peticion',
    openedBy: 'seller',
    order: 'required',
    items: 'none',
    photo: false,
    claimWindow: false,
    requiresPaid: false,
    routesToStore: false,
    storeSees: true,
    defaultLiable: null,
    refund: 'none',
  },
  {
    key: 'comprador_ausente',
    label: 'El comprador no estaba o rechazó el pedido',
    help: 'Elige el pedido y cuéntanos qué pasó en la entrega.',
    kind: 'queja',
    openedBy: 'seller',
    order: 'required',
    items: 'none',
    photo: false,
    claimWindow: false,
    requiresPaid: false,
    routesToStore: false,
    storeSees: true,
    defaultLiable: 'buyer',
    refund: 'none',
  },
  {
    key: 'desacuerdo_con_devolucion',
    label: 'No estoy de acuerdo con una devolución aprobada',
    help: 'Elige el pedido y explica por qué la devolución no procede. Adjunta fotos si las tienes.',
    kind: 'reclamo',
    openedBy: 'seller',
    order: 'required',
    items: 'none',
    photo: false,
    claimWindow: false,
    requiresPaid: false,
    routesToStore: false,
    storeSees: true,
    defaultLiable: null,
    refund: 'none',
  },
  {
    key: 'problema_con_dispersion',
    label: 'Problema con un pago de MercaMesa a mi tienda',
    help: 'Indica el pedido si aplica y qué valor esperabas recibir.',
    kind: 'reclamo',
    openedBy: 'seller',
    order: 'optional',
    items: 'none',
    photo: false,
    claimWindow: false,
    requiresPaid: false,
    routesToStore: false,
    storeSees: true,
    defaultLiable: null,
    refund: 'none',
  },
  {
    key: 'problema_con_domiciliario',
    label: 'Problema con el domiciliario',
    help: 'Elige el pedido y cuéntanos: recogida tardía, maltrato del paquete, etc.',
    kind: 'queja',
    openedBy: 'seller',
    order: 'required',
    items: 'none',
    photo: false,
    claimWindow: false,
    requiresPaid: false,
    routesToStore: false,
    storeSees: true,
    defaultLiable: 'logistics',
    refund: 'none',
  },
  {
    key: 'resena_injusta',
    label: 'Reseña injusta o abusiva',
    help: 'Copia el texto de la reseña y explica por qué debería retirarse.',
    kind: 'queja',
    openedBy: 'seller',
    order: 'none',
    items: 'none',
    photo: false,
    claimWindow: false,
    requiresPaid: false,
    routesToStore: false,
    storeSees: true,
    defaultLiable: null,
    refund: 'none',
  },
  {
    key: 'peticion_de_tienda',
    label: 'Otra petición o sugerencia',
    help: 'Dinos qué necesitas y te respondemos.',
    kind: 'peticion',
    openedBy: 'seller',
    order: 'optional',
    items: 'none',
    photo: false,
    claimWindow: false,
    requiresPaid: false,
    routesToStore: false,
    storeSees: true,
    defaultLiable: null,
    refund: 'none',
  },
];

const POR_CLAVE = new Map(PQRS_REASONS.map((r) => [r.key, r]));

export function getPqrsReason(key: string): PqrsReason | null {
  return POR_CLAVE.get(key) ?? null;
}

export function reasonsFor(opener: PqrsOpener): PqrsReason[] {
  return PQRS_REASONS.filter((r) => r.openedBy === opener);
}

/** Los motivos de comprador cuyos casos ve la tienda. */
export const STORE_VISIBLE_BUYER_REASONS = PQRS_REASONS.filter(
  (r) => r.openedBy === 'buyer' && r.storeSees
).map((r) => r.key);

export const PQRS_KIND_LABELS: Record<PqrsKind, string> = {
  peticion: 'Petición',
  queja: 'Queja',
  reclamo: 'Reclamo',
  sugerencia: 'Sugerencia',
};

export const PQRS_LIABLE_LABELS: Record<PqrsLiable, string> = {
  store: 'La tienda',
  logistics: 'MercaMesa (logística)',
  platform: 'MercaMesa',
  buyer: 'El comprador',
};
