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
  /** Desde qué puesto la está viendo quien pregunta. */
  viewer: PqrsViewer;
  /** Lo que ese puesto puede hacer ahora mismo. */
  can: {
    message: boolean;
    respondAsStore: boolean;
    resolve: boolean;
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
