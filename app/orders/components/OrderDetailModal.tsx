import React from 'react';
import { Modal } from '@/components/ui/modal/modal';
import { Button, cn } from '@/src/components/Shared';
import { formatOrderCode } from '@/src/features/orders/utils/orderCode';
import {
  MapPin,
  CreditCard,
  Calendar,
  Clock,
  ShoppingBag,
  Image as ImageIcon,
} from 'lucide-react';

import {
  OrderDetail,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from '../types/order.types';

import { ORDER_STATUS_CONFIG, PAYMENT_STATUS_CONFIG } from './OrderCard';
import { useOrderHistory } from '../hooks/useOrderHistory';

interface OrderDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderDetail | null;
}

export function OrderDetailModal({ isOpen, onClose, order }: OrderDetailModalProps) {
  const { history } = useOrderHistory(
    isOpen ? order?.order_id || null : null,
    isOpen ? order?.store_id || null : null
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
              {order.created_at ? new Date(order.created_at).toLocaleDateString() : ''} • {order.store_name}
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
                <span className="font-bold text-mm-g">{formatCurrency(item.total_price)}</span>
              </div>
            ))}
          </div>
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

          <div className="relative pl-6 border-l-2 border-mm-crd/60 space-y-5 ml-2">
            {history.length > 0 ? (
              history.map((h, i) => {
                const label = h.status ? ORDER_STATUS_LABELS[h.status] : 'Desconocido';
                const itemDate = new Date(h.createdAt).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                });
                const itemTime = new Date(h.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div key={h.id || i} className="relative">
                    <div
                      className={cn(
                        'absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-white',
                        h.status === order.status ? 'bg-mm-g scale-125 ring-4 ring-mm-gbg' : 'bg-mm-crd'
                      )}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-xs text-mm-g">{label}</span>
                      <span className="text-[10px] text-mm-txs font-semibold">
                        {itemDate} {itemTime}
                      </span>
                    </div>
                    {h.notes && (
                      <p className="text-xs text-mm-txs italic font-medium bg-slate-50 p-2.5 rounded-xl border border-mm-crd/40 mt-1 leading-relaxed">
                        "{h.notes}"
                      </p>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-xs text-mm-txw italic">
                No hay registros de cambios de estado todavía.
              </div>
            )}
          </div>
        </div>

        {/* Total */}
        <div className="bg-white rounded-3xl border border-mm-crd p-6 shadow-sm flex items-center justify-between">
          <span className="text-xs text-mm-txw font-bold uppercase tracking-widest">Total Pagado</span>
          <span className="text-2xl font-fraunces text-mm-g">{formatCurrency(order.total || 0)}</span>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2">
          <Button variant="outline" size="md" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
