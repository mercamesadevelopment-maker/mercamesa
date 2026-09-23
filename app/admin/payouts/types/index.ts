/** Los tipos de la pantalla de dispersiones. */

export type EstadoPayout = 'draft' | 'approved' | 'cancelled';

export interface Payout {
  id: string;
  consecutive: number;
  fileName: string | null;
  status: EstadoPayout;
  scheduledFor: string;
  totalAmount: number;
  itemsCount: number;
  hasFile: boolean;
  generatedAt: string | null;
  approvedAt: string | null;
  cancelledAt: string | null;
  generatedByName: string | null;
  approvedByName: string | null;
  notes: string | null;
}

export interface PedidoDeTienda {
  id: string;
  code: string | null;
  amount: number;
}

export interface TiendaEnPayout {
  storeId: string;
  storeName: string;
  holderName: string | null;
  bankCode: string | null;
  accountKind: 'checking' | 'savings' | null;
  /** Solo los últimos cuatro: para revisar no hace falta el número completo. */
  accountLast4: string;
  amount: number;
  orders: PedidoDeTienda[];
}

export interface PayoutDetalle extends Payout {
  stores: TiendaEnPayout[];
}

export interface Descartado {
  storeOrderId: string;
  storeOrderCode: string | null;
  storeName: string;
  amount: number;
  reason: string;
  reasonLabel: string;
}

export interface Elegibles {
  total: number;
  ordersCount: number;
  stores: { storeId: string; storeName: string; orders: number; amount: number }[];
  discarded: Descartado[];
  holdDays: number;
}

export interface CuentaBancaria {
  id: string;
  storeId: string;
  storeName: string;
  bankCode: string;
  bankName: string;
  accountKind: 'checking' | 'savings';
  accountNumber: string;
  bbvaOfficeCode: string | null;
  holderDocumentType: string;
  holderDocumentNumber: string;
  holderDocumentDv: string;
  holderName: string;
  holderAddress: string | null;
  holderEmail: string | null;
  status: 'pending' | 'verified' | 'rejected';
  rejectionReason: string | null;
  verifiedAt: string | null;
  verifiedByName: string | null;
  createdAt: string;
}

export interface ParametrosDispersion {
  id: string;
  ordererDocumentType: string;
  ordererDocumentNumber: string;
  ordererDv: string;
  ordererSuffix: string;
  ordererName: string;
  ordererAddress: string;
  ordererCity: string;
  bbvaOfficeCode: string;
  bbvaAccountNumber: string;
  emitterKey: string;
  paymentConcept: string;
  fileConsecutiveOffset: number;
  holdDays: number;
  notes: string | null;
  createdAt: string;
  changedByName: string | null;
}

export interface Banco {
  code: string;
  name: string;
  isActive: boolean;
}
