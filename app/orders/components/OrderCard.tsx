import React, { useState } from 'react';
import { motion } from 'motion/react';
import { formatOrderCode } from '@/src/features/orders/utils/orderCode';
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
  RotateCcw,
} from 'lucide-react';

import {
  OrderDetail,
  OrderStatus,
  PaymentStatus,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from '../types/order.types';

import { Button, cn } from '@/src/components/Shared';
import { OrderDetailModal } from './OrderDetailModal';
import { ReorderModal } from './ReorderModal';

interface OrderCardProps {
  order: OrderDetail;
  onRate?: (storeId: string) => void;
}

export const ORDER_STATUS_CONFIG: Record<OrderStatus, { color: string; icon: any }> = {
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

export const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, { color: string; icon: any }> = {
  pending: { color: 'bg-warnl text-warn', icon: Clock },
  processing: { color: 'bg-bluel text-blue', icon: CreditCard },
  approved: { color: 'bg-okl text-ok', icon: CheckCircle2 },
  rejected: { color: 'bg-rl text-r', icon: XCircle },
  refunded: { color: 'bg-mm-gbg text-mm-txw', icon: CreditCard },
  disputed: { color: 'bg-purple-100 text-purple-600', icon: CreditCard },
};

// En móvil los botones del pie se reparten el ancho en vez de ir en una fila
// que no cabe; desde `sm` recuperan su tamaño natural.
const FOOTER_BUTTON_CLASS = 'flex-1 sm:flex-none whitespace-nowrap';

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

  const [showDetail, setShowDetail] = useState(false);
  const [showReorder, setShowReorder] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-3xl sm:rounded-[32px] border border-mm-crd shadow-sm overflow-hidden"
    >
      {/* HEADER */}
      <div className="p-4 sm:p-6 border-b border-mm-crd flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-mm-gbg rounded-xl sm:rounded-2xl flex items-center justify-center overflow-hidden border border-mm-crd shadow-inner shrink-0">
            <img
              src={`https://api.dicebear.com/7.x/initials/svg?seed=${order.store_name}`}
              alt={order.store_name || 'Tienda'}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="min-w-0">
            <h3 className="font-bold text-mm-g break-words">
              {order.store_name}
            </h3>

            <p className="text-xs text-mm-txw">
              Pedido {formatOrderCode(order.order_code, order.order_id)} •{' '}
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
            'px-3 sm:px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 shrink-0',
            statusInfo.color
          )}
        >
          <statusInfo.icon className="w-4 h-4" />
          {statusInfo.label}
        </div>
      </div>

      {/* CONTENT */}
      <div className="p-4 sm:p-6 grid md:grid-cols-2 gap-6 sm:gap-8">
        {/* PRODUCTS */}
        <div>
          <p className="text-xs text-mm-txw font-bold uppercase tracking-widest mb-3 sm:mb-4">
            Productos
          </p>

          <div className="space-y-3">
            {products.map(
              (item: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  {/* min-w-0 + flex-1: un nombre largo se recorta a dos líneas en vez de empujar el precio. */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
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

                    <span className="text-mm-txs font-medium line-clamp-2 break-words">
                      {item.quantity}x{' '}
                      {item.catalog_name}
                    </span>
                  </div>

                  <span className="font-bold text-mm-g shrink-0 whitespace-nowrap">
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

            <div className="min-w-0">
              <p className="text-xs text-mm-txw font-bold uppercase tracking-widest">
                Entrega en
              </p>

              <p className="text-sm text-mm-txs break-words">
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
      {/* En móvil el total va arriba y los botones debajo: los tres juntos no caben en una fila de ~330px. */}
      <div className="p-4 sm:p-6 bg-mm-gbg/30 border-t border-mm-crd flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-baseline justify-between sm:flex-col sm:items-start">
          <span className="text-xs text-mm-txw font-bold uppercase tracking-widest">
            Total Pagado
          </span>

          <span className="text-xl sm:text-2xl font-fraunces text-mm-g whitespace-nowrap">
            {formatCurrency(order.total || 0)}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 sm:gap-3">
          <Button variant="outline" size="sm" className={FOOTER_BUTTON_CLASS} onClick={() => setShowDetail(true)}>
            Ver detalles
          </Button>

          {/* La recompra parte del pedido, no del carrito, así que se ofrece
              incluso en pedidos cancelados: el comprador puede querer repetirlo. */}
          {products.length > 0 && order.order_id && (
            <Button variant="outline" size="sm" className={FOOTER_BUTTON_CLASS} onClick={() => setShowReorder(true)}>
              <RotateCcw className="w-3.5 h-3.5" />
              Recomprar
            </Button>
          )}

          {order.status === 'delivered' &&
            onRate && (
              <Button
                size="sm"
                className={FOOTER_BUTTON_CLASS}
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
              className={FOOTER_BUTTON_CLASS}
            >
              Cancelar
            </Button>
          )}
        </div>
      </div>

      <OrderDetailModal
        isOpen={showDetail}
        onClose={() => setShowDetail(false)}
        order={order}
      />

      {order.order_id && (
        <ReorderModal
          isOpen={showReorder}
          onClose={() => setShowReorder(false)}
          orderId={order.order_id}
        />
      )}
    </motion.div>
  );
}
