import React from 'react';
import { Modal } from '@/components/ui/modal/modal';
import { Button, cn } from '@/src/components/Shared';
import { formatOrderCode } from '@/src/features/orders/utils/orderCode';
import { fechaCompleta } from '@/lib/dates/relative-time';
import { OrderStatusTimeline } from '@/src/features/orders/components/OrderStatusTimeline';
import {
  MapPin,
  CreditCard,
  Calendar,
  Clock,
  ShoppingBag,
  Image as ImageIcon,
  ShieldCheck,
} from 'lucide-react';

import {
  DELIVERY_CODE_NOTICE,
  DELIVERY_CODE_NOTICE_TITLE,
} from '@/lib/copy/security-notice';

import {
  OrderDetail,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from '../types/order.types';

import { ORDER_STATUS_CONFIG, PAYMENT_STATUS_CONFIG } from './OrderCard';
import { useOrderHistory } from '../hooks/useOrderHistory';
import { isPayable } from '../hooks/usePayOrder';
import { OrderSavings } from './OrderSavings';
import { DeliveryTracking } from '@/src/features/orders/components/DeliveryTracking';
import { useDeliveryTracking } from '@/src/features/orders/hooks/use-delivery-tracking';
import type { OrderStatus } from '../types/order.types';

/** Estados en los que el pedido ya tiene (o tuvo) domiciliario. */
const DELIVERY_STATUSES: OrderStatus[] = ['at_collection', 'dispatched', 'delivered', 'returned'];

interface OrderDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderDetail | null;
  /** Abre el formulario de PQRS para este pedido. */
  onReport?: () => void;
}

export function OrderDetailModal({ isOpen, onClose, order, onReport }: OrderDetailModalProps) {
  const { history } = useOrderHistory(
    isOpen ? order?.order_id || null : null,
    isOpen ? order?.store_id || null : null
  );

  // El domicilio de Pibox existe desde «Listo Recogida».
  const hasDelivery = !!order?.status && DELIVERY_STATUSES.includes(order.status);
  const tracking = useDeliveryTracking(
    order?.order_id && order?.store_id ? { orderId: order.order_id, storeId: order.store_id } : null,
    isOpen && hasDelivery
  );

  if (!order) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const statusInfo = order.status
    ? { label: ORDER_STATUS_LABELS[order.status], ...ORDER_STATUS_CONFIG[order.status] }
    : { label: 'Desconocido', color: 'bg-mm-gbg text-mm-txw', icon: Calendar };

  const paymentStatusInfo = order.payment_status
    ? { label: PAYMENT_STATUS_LABELS[order.payment_status], ...PAYMENT_STATUS_CONFIG[order.payment_status] }
    : { label: 'Desconocido', color: 'bg-mm-gbg text-mm-txw', icon: CreditCard };

  const products = (order.products as any[]) || [];

  const netPurchase =
    Number(order.order_subtotal ?? 0) +
    Number(order.service_commission_amount ?? 0) +
    Number(order.messages_amount ?? 0);
  const creditApplied = Number(order.credit_applied ?? 0);
  const orderTotal = Number(order.order_total ?? 0);
  // Mientras se pueda pagar, lo que falta es lo que cobra la pasarela.
  const payable = isPayable(order.payable_until);
  const amountShown = payable ? orderTotal - creditApplied : orderTotal;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalle de Pedido" maxWidth="max-w-2xl">
      <div className="p-8 space-y-6 bg-slate-50/50">

        {/* Header info */}
        <div className="bg-white rounded-3xl border border-mm-crd p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
          <div>
            <span className="text-lg font-bold text-mm-g">
              Pedido {formatOrderCode(order.order_code, order.order_id)}
            </span>
            <p className="text-xs text-mm-txw mt-1">
              {order.created_at ? fechaCompleta(order.created_at) : ''} • {order.store_name}
            </p>
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

        {/* Products */}
        <div className="bg-white rounded-3xl border border-mm-crd p-6 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4 border-b border-mm-crd/65 pb-4">
            <div className="w-9 h-9 bg-mm-gbg/45 rounded-xl flex items-center justify-center text-mm-g">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-mm-g text-base">Productos</h3>
          </div>

          <div className="space-y-3">
            {products.map((item: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between text-sm">
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
                    {item.quantity}x {item.catalog_name}
                  </span>
                </div>
                <span className="shrink-0 whitespace-nowrap text-right">
                  {Number(item.list_unit_price) > Number(item.unit_price) && (
                    <span className="mr-1.5 text-xs text-mm-txw line-through decoration-r">
                      {formatCurrency(Number(item.list_unit_price) * Number(item.quantity))}
                    </span>
                  )}
                  <span className="font-bold text-mm-g">{formatCurrency(item.total_price)}</span>
                </span>
              </div>
            ))}
          </div>

          <OrderSavings
            amount={Number(order.discount_total ?? 0)}
            className="mt-4 border-t border-mm-crd/65 pt-4"
          />
        </div>

        {/* Delivery + payment */}
        <div className="bg-white rounded-3xl border border-mm-crd p-6 shadow-sm space-y-4">
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-mm-txw shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-mm-txw font-bold uppercase tracking-widest">Entrega en</p>
              <p className="text-sm text-mm-txs">
                {order.address_line}, {order.neighborhood}, {order.municipality}
              </p>
              {order.delivery_instructions && (
                <p className="mt-1 text-sm text-mm-txs italic">
                  {order.delivery_instructions}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <CreditCard className="w-5 h-5 text-mm-txw shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-mm-txw font-bold uppercase tracking-widest">Método de pago</p>
              <p className="text-sm text-mm-txs font-medium mb-1">
                {order.payment_method_label || 'No especificado'}
              </p>
              <div
                className={cn(
                  'inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold',
                  paymentStatusInfo.color
                )}
              >
                <paymentStatusInfo.icon className="w-3 h-3" />
                {paymentStatusInfo.label}
              </div>
            </div>
          </div>
        </div>

        {/* Status history */}
        <div className="bg-white rounded-3xl border border-mm-crd p-6 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4 border-b border-mm-crd/65 pb-4">
            <div className="w-9 h-9 bg-mm-gbg/45 rounded-xl flex items-center justify-center text-mm-g">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-mm-g text-base">Historial de Estado</h3>
          </div>

          <OrderStatusTimeline
            history={history}
            currentStatus={order.status}
            getLabel={(s) => ORDER_STATUS_LABELS[s] || 'Desconocido'}
          />
        </div>

        {hasDelivery && (
          <DeliveryTracking
            delivery={tracking.data?.delivery ?? null}
            viewer={tracking.data?.viewer ?? null}
            loading={tracking.loading}
            error={tracking.error}
          />
        )}

        {/* Total. Mismo desglose que el carrito y la factura: tres conceptos.
            Es el del pedido completo, no solo los productos de esta tienda. */}
        <div className="bg-white rounded-3xl border border-mm-crd p-6 shadow-sm space-y-2.5">
          <div className="flex justify-between text-sm text-mm-txs">
            <span>Productos y servicio de compra</span>
            <span className="font-bold">{formatCurrency(netPurchase)}</span>
          </div>
          <div className="flex justify-between text-sm text-mm-txs">
            <span>Domicilio</span>
            <span className="font-bold">{formatCurrency(Number(order.delivery_fee ?? 0))}</span>
          </div>
          <div className="flex justify-between text-sm text-mm-txs">
            <span>Servicio MercaMesa</span>
            <span className="font-bold">{formatCurrency(Number(order.platform_commission_amount ?? 0))}</span>
          </div>
          {creditApplied > 0 && (
            <div className="flex justify-between text-sm text-mm-txs">
              <span>Saldo a favor</span>
              <span className="font-bold text-ok">−{formatCurrency(creditApplied)}</span>
            </div>
          )}
          <div className="pt-3 border-t border-mm-crd/65 flex items-center justify-between">
            <span className="text-xs text-mm-txw font-bold uppercase tracking-widest">
              {payable ? 'Total a pagar' : 'Total Pagado'}
            </span>
            <span className="text-2xl font-fraunces text-mm-g">{formatCurrency(amountShown)}</span>
          </div>
        </div>

        {/* Seguridad. Va acá y no antes de pagar: el código de entrega solo
            existe cuando el pedido ya está en camino, así que este es el momento
            en que el consejo se puede aplicar. */}
        <div className="bg-white rounded-3xl border border-mm-crd p-6 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4 border-b border-mm-crd/65 pb-4">
            <div className="w-9 h-9 bg-mm-gbg/45 rounded-xl flex items-center justify-center text-mm-g">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-mm-g text-base">{DELIVERY_CODE_NOTICE_TITLE}</h3>
          </div>

          <div className="space-y-2.5 text-xs text-mm-txs leading-relaxed">
            {DELIVERY_CODE_NOTICE.map((parrafo) => (
              <p key={parrafo}>{parrafo}</p>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-2">
          {onReport ? (
            <Button variant="ghost" size="md" onClick={onReport}>
              Reportar un problema
            </Button>
          ) : (
            <span />
          )}
          <Button variant="outline" size="md" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
