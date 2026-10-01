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
  /** Línea negativa: un descuento por una devolución, rotulado con su pedido. */
  isCharge?: boolean;
}

export interface TiendaEnPayout {
  storeId: string;
  storeName: string;
  holderName: string | null;
  paymentMethod: 'account' | 'breb';
  bankCode: string | null;
  accountKind: 'checking' | 'savings' | null;
  /** Solo los últimos cuatro de la cuenta o de la llave: para revisar no hace
   *  falta el dato completo. */
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
  /** `amount` es el neto; `charges`, lo descontado por devoluciones que la tienda asumió. */
  stores: { storeId: string; storeName: string; orders: number; amount: number; charges: number }[];
  discarded: Descartado[];
  holdDays: number;
}

export interface CuentaBancaria {
  id: string;
  storeId: string;
  storeName: string;
  /** Cuenta bancaria o llave Bre-B: la tienda elige una. */
  paymentMethod: 'account' | 'breb';
  brebKey: string | null;
  bankCode: string | null;
  bankName: string | null;
  accountKind: 'checking' | 'savings' | null;
  accountNumber: string | null;
  bbvaOfficeCode: string | null;
  holderDocumentType: string;
  holderDocumentNumber: string;
  holderDocumentDv: string;
  holderName: string;
  holderAddress: string;
  holderEmail: string | null;
  status: 'pending' | 'verified' | 'rejected';
  rejectionReason: string | null;
  verifiedAt: string | null;
  verifiedByName: string | null;
  createdAt: string;
}

/** En el formato por líneas el archivo no lleva datos del ordenante: solo el
 *  concepto de pago de cada línea y la regla de días de espera. */
export interface ParametrosDispersion {
  id: string;
  paymentConcept: string;
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
