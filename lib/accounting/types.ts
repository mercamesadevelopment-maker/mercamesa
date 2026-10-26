/** Lo que devuelven los listados de Contabilidad. Los comparten el servidor y la pantalla. */

import type { OrderInvoiceLink } from '@/lib/siigo/invoice-link';

export interface Page<T, Totals> {
  rows: T[];
  totals: Totals;
  total: number;
  page: number;
  pageSize: number;
}

export interface PaymentRow {
  id: string;
  createdAt: string;
  orderId: string;
  orderCode: string | null;
  buyerName: string | null;
  storeNames: string[];
  marketplaceNames: string[];
  provider: string;
  method: string | null;
  status: string;
  amount: number;
}

export interface PaymentTotals {
  approved: number;
  approvedCount: number;
  notApproved: number;
  notApprovedCount: number;
}

export interface CreditNoteRow {
  id: string;
  createdAt: string;
  /** El enlace de la nota en Siigo, si ya existe. Se arma igual que el de la factura. */
  document: OrderInvoiceLink | null;
  status: string;
  lastError: string | null;
  orderCode: string | null;
  pqrsCode: string | null;
  buyerName: string | null;
  storeName: string | null;
  marketplaceName: string | null;
  amount: number;
  liable: string;
}

export interface CreditNoteTotals {
  amount: number;
  sent: number;
  pending: number;
  failed: number;
}

export interface RefundRow {
  id: string;
  createdAt: string;
  orderCode: string | null;
  pqrsCode: string | null;
  buyerName: string | null;
  storeName: string | null;
  marketplaceName: string | null;
  amount: number;
  status: 'money_pending' | 'money_paid';
  reference: string | null;
  paidAt: string | null;
  paidByName: string | null;
}

export interface RefundTotals {
  pending: number;
  pendingCount: number;
  paid: number;
  paidCount: number;
}

export interface AccountingOptions {
  stores: { id: string; name: string; marketplaceId: string | null }[];
  marketplaces: { id: string; name: string }[];
}
