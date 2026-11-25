import { CheckCircle2, Clock, CreditCard, XCircle } from 'lucide-react';
import type { PaymentStatus } from '@/app/orders/types/order.types';

/** Color e ícono de cada estado del pago, como lo ve el comprador. */
export const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, { color: string; icon: any }> = {
  pending: { color: 'bg-warnl text-warn', icon: Clock },
  processing: { color: 'bg-bluel text-blue', icon: CreditCard },
  approved: { color: 'bg-okl text-ok', icon: CheckCircle2 },
  rejected: { color: 'bg-rl text-r', icon: XCircle },
  refunded: { color: 'bg-mm-gbg text-mm-txw', icon: CreditCard },
  disputed: { color: 'bg-purple-100 text-purple-600', icon: CreditCard },
};
