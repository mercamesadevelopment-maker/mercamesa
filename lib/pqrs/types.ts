import type { PqrsKind, PqrsLiable, PqrsOpener } from './reasons';

/**
 * Lo que viaja entre `app/api/pqrs` y las pantallas. Vive en `lib/` porque lo
 * usan los dos lados.
 */

export type PqrsStatus = 'awaiting_store' | 'in_review' | 'resolved';
export type PqrsOutcome = 'approved' | 'rejected' | 'answered';
export type PqrsStoreResponse = 'accepted' | 'rejected' | 'expired';

/** Desde qué puesto se mira una PQRS. Decide qué se ve y qué se puede hacer. */
export type PqrsViewer = 'buyer' | 'seller' | 'admin';

export const PQRS_STATUS_LABELS: Record<PqrsStatus, string> = {
  awaiting_store: 'Esperando a la tienda',
  in_review: 'En revisión de MercaMesa',
  resolved: 'Resuelta',
};

export const PQRS_OUTCOME_LABELS: Record<PqrsOutcome, string> = {
  approved: 'Aprobada',
  rejected: 'No procede',
  answered: 'Respondida',
};

export interface PqrsSummary {
  id: string;
  code: string;
  kind: PqrsKind;
  reason: string;
  reasonLabel: string;
  subject: string;
  status: PqrsStatus;
  outcome: PqrsOutcome | null;
  openedAs: PqrsOpener;
  openedByName: string | null;
  buyerName: string | null;
  storeId: string | null;
  storeName: string | null;
  orderCode: string | null;
  storeResponseDueAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PqrsItem {
  id: string;
  orderItemId: string;
  name: string;
  unit: string | null;
  quantity: number;
  unitPrice: number;
}

export interface PqrsAttachment {
  id: string;
  /** URL firmada, de vida corta. */
  url: string | null;
  messageId: string | null;
}

export interface PqrsMessage {
  id: string;
  authorAs: 'buyer' | 'seller' | 'admin' | 'system';
  authorName: string | null;
  body: string;
  isInternal: boolean;
  createdAt: string;
  attachments: PqrsAttachment[];
}

/** El bloqueo que salió de una solicitud «bloquear comprador». */
export interface PqrsBlock {
  id: string;
  createdAt: string;
  liftedAt: string | null;
  liftNotes: string | null;
}

/** Cómo le ha ido al comprador del caso en la tienda del caso. */
export interface PqrsBuyerHistory {
  total: number;
  delivered: number;
  cancelled: number;
  expiredUnpaid: number;
  paymentRejected: number;
}

/**
 * La devolución de un caso aprobado. Cada puesto recibe solo lo suyo: lo que no
 * le corresponde llega en `null`.
 */
export interface PqrsRefund {
  createdAt: string;
  /** Lo acreditado al comprador. La tienda no lo recibe. */
  total: number | null;
  method: 'credit' | 'money' | null;
  status: 'credited' | 'money_pending' | 'money_paid' | null;
  moneyPaidAt: string | null;
  /** Lo que se le descuenta a la tienda. El comprador no lo recibe. */
  storeCharge: number | null;
  /** Solo para el administrador. */
  breakdown: {
    scope: 'items' | 'order';
    products: number;
    serviceCommission: number;
    platformCommission: number;
    messages: number;
    delivery: number;
    liable: 'store' | 'logistics' | 'platform';
    moneyReference: string | null;
  } | null;
  can: { toMoney: boolean; markPaid: boolean; voidStoreCharge: boolean };
}

/** Lo que pasaría si el caso se aprueba, para decidir con el número a la vista. */
export interface PqrsRefundPreview {
  /** Lo que recibiría el comprador devolviendo los productos marcados. */
  itemsTotal: number | null;
  /** Lo que asumiría la tienda en ese caso: el valor de sus productos. */
  itemsStoreCharge: number | null;
  /** Lo que recibiría devolviendo el pedido completo. Solo para el admin. */
  orderTotal: number | null;
}

export interface PqrsDetail extends PqrsSummary {
  description: string;
  liable: PqrsLiable | null;
  storeResponse: PqrsStoreResponse | null;
  storeRespondedAt: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  items: PqrsItem[];
  attachments: PqrsAttachment[];
  messages: PqrsMessage[];
  /** Solo en solicitudes de bloqueo ya aprobadas. Nunca le llega al comprador. */
  block: PqrsBlock | null;
  /** Solo en los casos del tendero contra un comprador. */
  buyerHistory: PqrsBuyerHistory | null;
  /** La devolución, si el caso se aprobó con una. */
  refund: PqrsRefund | null;
  /** Mientras el caso está abierto y su motivo devuelve algo. */
  refundPreview: PqrsRefundPreview | null;
  /** Desde qué puesto la está viendo quien pregunta. */
  viewer: PqrsViewer;
  /** Lo que ese puesto puede hacer ahora mismo. */
  can: {
    message: boolean;
    respondAsStore: boolean;
    resolve: boolean;
    liftBlock: boolean;
  };
}

/** Un pedido que se puede elegir en el formulario. */
export interface PqrsOrderOption {
  storeOrderId: string;
  code: string | null;
  storeId: string;
  storeName: string;
  status: string;
  createdAt: string;
  buyerName: string | null;
}

export interface PqrsOrderContext extends PqrsOrderOption {
  paid: boolean;
  deliveredAt: string | null;
  items: { id: string; name: string; unit: string | null; quantity: number; unitPrice: number }[];
}

export interface PqrsReasonOption {
  key: string;
  label: string;
  help: string;
  kind: PqrsKind;
  order: 'none' | 'optional' | 'required';
  items: 'none' | 'optional' | 'required';
  photo: boolean;
  /** Con un pedido elegido: por qué este motivo no aplica a ese pedido. */
  unavailableWhy: string | null;
}

export interface PqrsFormContext {
  orders: PqrsOrderOption[];
  order: PqrsOrderContext | null;
  reasons: PqrsReasonOption[];
  claimWindowHours: number;
}

export interface NewPqrsInput {
  reason: string;
  description: string;
  storeOrderId?: string | null;
  /** Solo el tendero, cuando el motivo no lleva pedido. */
  storeId?: string | null;
  items?: { orderItemId: string; quantity: number }[];
  /** Rutas temporales que devolvió `/api/pqrs/uploads`. */
  attachments?: string[];
}

export interface PqrsSettings {
  id: string;
  claimWindowHours: number;
  storeResponseHours: number;
}
