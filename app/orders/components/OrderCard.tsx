import React from 'react';
import { motion } from 'motion/react';
import {
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  CreditCard,
  Wallet,
  Image as ImageIcon,
} from 'lucide-react';

import {
  OrderDetail,
  OrderStatus,
  PaymentStatus,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from '../types/order.types';

import { Button, cn } from '@/src/components/Shared';

interface OrderCardProps {
  order: OrderDetail;
  onRate?: (storeId: string) => void;
}

const ORDER_STATUS_CONFIG: Record<OrderStatus, { color: string; icon: any }> = {
  pending: { color: 'bg-warnl text-warn', icon: Clock },
  confirmed: { color: 'bg-bluel text-blue', icon: CheckCircle2 },
  paid: { color: 'bg-okl text-ok', icon: CreditCard },
  packing: { color: 'bg-bluel text-blue', icon: Package },
  at_collection: { color: 'bg-purple-100 text-purple-600', icon: MapPin },
  dispatched: { color: 'bg-purple-100 text-purple-600', icon: Truck },
  delivered: { color: 'bg-okl text-ok', icon: CheckCircle2 },
  cancelled: { color: 'bg-rl text-r', icon: XCircle },
  returned: { color: 'bg-mm-gbg text-mm-txw', icon: XCircle },
};

const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, { color: string; icon: any }> = {
  pending: { color: 'bg-warnl text-warn', icon: Clock },
  processing: { color: 'bg-bluel text-blue', icon: CreditCard },
  approved: { color: 'bg-okl text-ok', icon: CheckCircle2 },
  rejected: { color: 'bg-rl text-r', icon: XCircle },
  refunded: { color: 'bg-mm-gbg text-mm-txw', icon: CreditCard },
  disputed: { color: 'bg-purple-100 text-purple-600', icon: CreditCard },
};

export function OrderCard({
  order,
  onRate,
}: OrderCardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const statusInfo = order.status 
    ? { label: ORDER_STATUS_LABELS[order.status], ...ORDER_STATUS_CONFIG[order.status] }
    : { label: 'Desconocido', color: 'bg-mm-gbg text-mm-txw', icon: Clock };

  const paymentStatusInfo = order.payment_status
    ? { label: PAYMENT_STATUS_LABELS[order.payment_status], ...PAYMENT_STATUS_CONFIG[order.payment_status] }
    : { label: 'Desconocido', color: 'bg-mm-gbg text-mm-txw', icon: Clock };

  const products = (order.products as any[]) || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-[32px] border border-mm-crd shadow-sm overflow-hidden"
    >
      {/* HEADER */}
      <div className="p-6 border-b border-mm-crd flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-mm-gbg rounded-2xl flex items-center justify-center overflow-hidden border border-mm-crd shadow-inner">
            <img
              src={`https://api.dicebear.com/7.x/initials/svg?seed=${order.store_name}`}
              alt={order.store_name || 'Tienda'}
              className="w-full h-full object-cover"
            />
          </div>

          <div>
            <h3 className="font-bold text-mm-g">
              {order.store_name}
            </h3>

            <p className="text-xs text-mm-txw">
              Pedido #
              {order.order_id?.slice(0, 8)} •{' '}
              {order.created_at
                ? new Date(
                    order.created_at
                  ).toLocaleDateString()
                : ''}
            </p>
          </div>
        </div>

        <div
          className={cn(
            'px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2',
            statusInfo.color
          )}
        >
          <statusInfo.icon className="w-4 h-4" />
          {statusInfo.label}
        </div>
      </div>

      {/* CONTENT */}
      <div className="p-6 grid md:grid-cols-2 gap-8">
        {/* PRODUCTS */}
        <div>
          <p className="text-xs text-mm-txw font-bold uppercase tracking-widest mb-4">
            Productos
          </p>

          <div className="space-y-3">
            {products.map(
              (item: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-mm-gbg rounded-lg flex items-center justify-center text-lg overflow-hidden shrink-0 border border-mm-crd/50">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.catalog_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-mm-txw" />
                      )}
                    </div>

                    <span className="text-mm-txs font-medium">
                      {item.quantity}x{' '}
                      {item.catalog_name}
                    </span>
                  </div>

                  <span className="font-bold text-mm-g">
                    {formatCurrency(
                      item.total_price
                    )}
                  </span>
                </div>
              )
            )}
          </div>
        </div>

        {/* INFO */}
        <div className="space-y-4">
          {/* ADDRESS */}
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-mm-txw shrink-0 mt-0.5" />

            <div>
              <p className="text-xs text-mm-txw font-bold uppercase tracking-widest">
                Entrega en
              </p>

              <p className="text-sm text-mm-txs">
                {order.address_line},{' '}
                {order.neighborhood},{' '}
                {order.municipality}
              </p>
            </div>
          </div>

          {/* PAYMENT METHOD */}
          <div className="flex items-start gap-3">
            <Wallet className="w-5 h-5 text-mm-txw shrink-0 mt-0.5" />

            <div>
              <p className="text-xs text-mm-txw font-bold uppercase tracking-widest">
                Método de pago
              </p>

              <p className="text-sm text-mm-txs font-medium">
                {order.payment_method_label || 'No especificado'}
              </p>
            </div>
          </div>

          {/* PAYMENT STATUS */}
          <div className="flex items-start gap-3">
            <CreditCard className="w-5 h-5 text-mm-txw shrink-0 mt-0.5" />

            <div>
              <p className="text-xs text-mm-txw font-bold uppercase tracking-widest">
                Estado del pago
              </p>

              <div
                className={cn(
                  'inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mt-1',
                  paymentStatusInfo.color
                )}
              >
                <paymentStatusInfo.icon className="w-3 h-3" />
                {paymentStatusInfo.label}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="p-6 bg-mm-gbg/30 border-t border-mm-crd flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs text-mm-txw font-bold uppercase tracking-widest">
            Total Pagado
          </span>

          <span className="text-2xl font-fraunces text-mm-g">
            {formatCurrency(order.total || 0)}
          </span>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" size="sm">
            Ver factura
          </Button>

          {order.status === 'delivered' &&
            onRate && (
              <Button
                size="sm"
                onClick={() =>
                  order.store_id &&
                  onRate(order.store_id)
                }
              >
                Calificar
              </Button>
            )}

          {order.status === 'pending' && (
            <Button
              variant="danger"
              size="sm"
            >
              Cancelar
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
