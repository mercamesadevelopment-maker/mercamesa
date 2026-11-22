import React from 'react';
import { Modal } from '@/components/ui/modal/modal';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { formatOrderCode } from '@/lib/orders/order-code';
import { fechaCompleta } from '@/lib/dates/relative-time';
import { buyerInvoiceConcepts } from '@/lib/pricing/buyer-concepts';
import { buyerOrderProgress } from '@/lib/orders/buyer-progress';
import { formatCOP } from '@/lib/utils/format';
import { OrderStatusTimeline } from '@/features/orders/components/OrderStatusTimeline';
import { InvoiceLink } from '@/features/orders/components/InvoiceLink';
import { MapPin, CreditCard, Clock, ShoppingBag, Image as ImageIcon } from 'lucide-react';

import { OrderDetail, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '../types/order.types';
import { PAYMENT_STATUS_CONFIG } from './OrderCard';
import { useOrderHistory } from '../hooks/useOrderHistory';
import { isPayable } from '../hooks/usePayOrder';
import { OrderSavings } from './OrderSavings';
import { BuyerOrderHero } from './BuyerOrderHero';
import { ProtectOrderCard } from './ProtectOrderCard';
import { OrderSection } from './OrderSection';
import { useDeliveryTracking } from '@/features/orders/hooks/use-delivery-tracking';
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

/**
 * El detalle del pedido para el comprador. Arriba, lo que busca al abrirlo: en
 * qué va su pedido (frase grande y barra de pasos), el código de entrega y a
 * dónde llega. Lo demás —productos, pago, historial— queda plegado.
 */
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

  const delivery = tracking.data?.delivery ?? null;
  const payable = isPayable(order.payable_until);
  const progress = buyerOrderProgress(order.status, delivery, { payable });

  const paymentStatusInfo = order.payment_status
    ? { label: PAYMENT_STATUS_LABELS[order.payment_status], ...PAYMENT_STATUS_CONFIG[order.payment_status] }
    : { label: 'Desconocido', color: 'bg-mm-gbg text-mm-txw', icon: CreditCard };

  const products = (order.products as any[]) || [];
  const unidades = products.length;

  // Los dos conceptos de la factura: lo del tendero y todo lo de MercaMesa.
  const creditApplied = Number(order.credit_applied ?? 0);
  const orderTotal = Number(order.order_total ?? 0);
  const { thirdPartyProducts, delivery: domicilio } = buyerInvoiceConcepts(Number(order.order_subtotal ?? 0), orderTotal);
  // Mientras se pueda pagar, lo que falta es lo que cobra la pasarela.
  const amountShown = payable ? orderTotal - creditApplied : orderTotal;

  const meta = [
    `Pedido ${formatOrderCode(order.order_code, order.order_id)}`,
    order.store_name,
    order.created_at ? fechaCompleta(order.created_at) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  // El código importa desde que el pedido avanza hasta que llega.
  const conCodigo = progress.step !== null && progress.tone !== 'done';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Tu pedido" maxWidth="max-w-2xl">
      <div className="space-y-5 p-5 sm:p-8">
        <BuyerOrderHero progress={progress} meta={meta} />

        {conCodigo && <ProtectOrderCard delivery={delivery} delivered={false} />}

        {/* A dónde llega. */}
        <div className="flex items-start gap-3">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-mm-txw" />
          <div className="min-w-0">
            <p className="text-xs text-mm-txw">Entrega en</p>
            <p className="text-sm font-semibold text-tinta break-words">
              {[order.address_line, order.neighborhood, order.municipality].filter(Boolean).join(', ')}
            </p>
            {order.delivery_instructions && (
              <p className="mt-0.5 text-xs italic text-mm-txs break-words">{order.delivery_instructions}</p>
            )}
          </div>
        </div>

        <div>
          {/* Los mismos dos conceptos que la canasta y la factura: productos de
              terceros (lo del tendero) y domicilio (todo lo de MercaMesa). */}
          <OrderSection
            icon={ShoppingBag}
            title="Resumen del pedido"
            summary={`${unidades} ${unidades === 1 ? 'producto' : 'productos'} · ${formatCOP(amountShown)}`}
          >
            <div className="space-y-3">
              {products.map((item: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-mm-crd/50 bg-mm-gbg">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.catalog_name} className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-mm-txw" />
                      )}
                    </div>
                    <span className="truncate font-medium text-mm-txs">
                      {item.quantity}x {item.catalog_name}
                    </span>
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-right">
                    {Number(item.list_unit_price) > Number(item.unit_price) && (
                      <span className="mr-1.5 text-xs text-mm-txw line-through decoration-r">
                        {formatCOP(Number(item.list_unit_price) * Number(item.quantity))}
                      </span>
                    )}
                    <span className="font-bold text-mm-g">{formatCOP(item.total_price)}</span>
                  </span>
                </div>
              ))}
            </div>

            <OrderSavings amount={Number(order.discount_total ?? 0)} className="mt-4 border-t border-mm-crd/65 pt-4" />

            <div className="mt-4 space-y-2 border-t border-mm-crd/65 pt-4 text-sm text-mm-txs">
              <Linea label="Productos de terceros" valor={formatCOP(thirdPartyProducts)} />
              <Linea label="Domicilio" valor={formatCOP(domicilio)} />
              {/* Informativo: el IVA ya va dentro del precio de los productos. */}
              <Linea label="IVA (incluido)" valor={formatCOP(Number(order.order_iva_total ?? 0))} />
              {creditApplied > 0 && (
                <Linea label="Saldo a favor" valor={`−${formatCOP(creditApplied)}`} className="text-ok" />
              )}
              <div className="flex items-center justify-between border-t border-mm-crd/65 pt-3">
                <span className="text-xs font-bold uppercase tracking-widest text-mm-txw">
                  {payable ? 'Total a pagar' : 'Total pagado'}
                </span>
                <span className="font-display text-2xl text-mm-g">{formatCOP(amountShown)}</span>
              </div>
            </div>
          </OrderSection>

          <OrderSection
            icon={CreditCard}
            title="Pago y factura"
            summary={`${order.payment_method_label || 'Pago'} · ${paymentStatusInfo.label}`}
          >
            <div className="space-y-3">
              <div
                className={cn(
                  'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold',
                  paymentStatusInfo.color
                )}
              >
                <paymentStatusInfo.icon className="h-3 w-3" />
                {paymentStatusInfo.label}
              </div>
              <p className="text-sm text-mm-txs">{order.payment_method_label || 'Método de pago no especificado'}</p>
              {order.invoice ? (
                <InvoiceLink invoice={order.invoice} />
              ) : (
                <p className="text-xs text-mm-txw">La factura aparece aquí cuando se emita.</p>
              )}
            </div>
          </OrderSection>

          <OrderSection icon={Clock} title="Historial del pedido" summary={order.status ? ORDER_STATUS_LABELS[order.status] : undefined}>
            <OrderStatusTimeline
              history={history}
              currentStatus={order.status}
              getLabel={(s) => ORDER_STATUS_LABELS[s] || 'Desconocido'}
            />
          </OrderSection>
        </div>

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-between">
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

function Linea({ label, valor, className }: { label: string; valor: string; className?: string }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className={cn('font-bold', className)}>{valor}</span>
    </div>
  );
}
