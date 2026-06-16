import React from 'react';
import { Modal } from '@/components/ui/modal/modal';
import { Button, Badge } from '@/src/components/Shared';
import { fmt } from '@/src/constants';
import { Order, OrderStatus } from '@/src/types';
import { 
  User, Phone, Mail, FileText, MapPin, 
  CreditCard, Calendar, Clock, ShoppingBag, 
  MessageSquare, ChevronRight, CheckCircle2, 
  AlertCircle, ShieldAlert 
} from 'lucide-react';

interface OrderDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onStartStatusChange: (orderId: string, status: OrderStatus, nextStatusLabel: string, actionLabel: string) => void;
}

export function OrderDetailModal({
  isOpen,
  onClose,
  order,
  onStartStatusChange,
}: OrderDetailModalProps) {
  if (!order) return null;

  const getStatusConfig = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return {
          label: 'Nuevo',
          color: 'bg-mm-orl text-mm-oro border-mm-oro/20',
          action: 'Confirmar Pedido',
          next: 'confirmed' as const,
        };
      case 'confirmed':
        return {
          label: 'Confirmado',
          color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          action: 'Iniciar Empaque',
          next: 'packing' as const,
        };
      case 'paid':
        return {
          label: 'Pagado',
          color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          action: 'Iniciar Empaque',
          next: 'packing' as const,
        };
      case 'packing':
        return {
          label: 'Empacando',
          color: 'bg-blue-50 text-blue-700 border-blue-200',
          action: 'Listo para Recoger',
          next: 'at_collection' as const,
        };
      case 'at_collection':
        return {
          label: 'Listo para Recoger',
          color: 'bg-purple-50 text-purple-700 border-purple-200',
          action: 'Despachar Pedido',
          next: 'dispatched' as const,
        };
      case 'dispatched':
        return {
          label: 'En Camino',
          color: 'bg-amber-50 text-amber-700 border-amber-200',
          action: 'Marcar como Entregado',
          next: 'delivered' as const,
        };
      case 'delivered':
        return {
          label: 'Entregado',
          color: 'bg-green-50 text-green-700 border-green-200',
          action: null,
          next: null,
        };
      case 'returned':
        return {
          label: 'Devuelto',
          color: 'bg-slate-50 text-slate-700 border-slate-200',
          action: null,
          next: null,
        };
      default: // cancelled
        return {
          label: 'Cancelado',
          color: 'bg-red-50 text-red-700 border-red-200',
          action: null,
          next: null,
        };
    }
  };

  const statusConfig = getStatusConfig(order.status);
  const formattedDate = new Date(order.date).toLocaleDateString([], {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const formattedTime = new Date(order.date).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleAction = () => {
    if (statusConfig.next) {
      onStartStatusChange(
        order.id, 
        statusConfig.next, 
        getStatusConfig(statusConfig.next).label, 
        statusConfig.action || 'Confirmar'
      );
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Detalle de Pedido`}
      maxWidth="max-w-4xl"
    >
      <div className="p-8 space-y-8 bg-slate-50/50">
        
        {/* Top Header Panel */}
        <div className="bg-white rounded-3xl border border-mm-crd p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <span className="text-xl font-bold text-mm-g">Pedido #{order.id}</span>
              {order.storeOrderId && (
                <Badge variant="default" className="text-[10px] uppercase font-bold tracking-wider">
                  Interno: #{order.storeOrderId.substring(0, 8)}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-mm-txs">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-mm-txw" /> {formattedDate}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-mm-txw" /> {formattedTime}
              </span>
              <span>•</span>
              <span className="font-semibold text-mm-g">Tienda: {order.storeName}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-4 py-1.5 rounded-2xl text-xs font-black uppercase tracking-wider border ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
          </div>
        </div>

        {/* Two Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column (Products, Notes, History Timeline) - 7 cols */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Products List Card */}
            <div className="bg-white rounded-3xl border border-mm-crd p-6 shadow-sm">
              <div className="flex items-center gap-2.5 mb-6 border-b border-mm-crd/65 pb-4">
                <div className="w-9 h-9 bg-mm-gbg/45 rounded-xl flex items-center justify-center text-mm-g">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-mm-g text-base">Contenido del Pedido</h3>
                  <p className="text-[10px] text-mm-txw font-black uppercase tracking-wider">Productos solicitados</p>
                </div>
              </div>

              <div className="space-y-4">
                {order.items.map((item, idx) => (
                  <div 
                    key={item.id || idx} 
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-mm-gbg/10 border border-mm-crd/40 hover:border-mm-g/20 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl select-none flex-shrink-0" role="img" aria-label="product emoji">
                        {item.emoji || '📦'}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-mm-g truncate">{item.name}</p>
                        <p className="text-[11px] text-mm-txs font-semibold">
                          {item.qty} {item.unit} x {fmt(item.price)}
                        </p>
                      </div>
                    </div>
                    <div className="text-sm font-black text-mm-g ml-4">
                      {fmt(item.price * item.qty)}
                    </div>
                  </div>
                ))}

                {order.items.length === 0 && (
                  <div className="text-center py-10 text-mm-txw">
                    No hay productos asociados a esta tienda.
                  </div>
                )}
              </div>
            </div>

            {/* Notes Card */}
            {order.notes && (
              <div className="bg-amber-50/50 rounded-3xl border border-amber-100 p-6 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-amber-100/70 rounded-xl flex items-center justify-center text-amber-700 flex-shrink-0">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-amber-950 mb-1">Notas e Instrucciones del Cliente</h4>
                    <p className="text-xs text-amber-900 leading-relaxed font-medium italic">
                      "{order.notes}"
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Activity History Timeline Card */}
            <div className="bg-white rounded-3xl border border-mm-crd p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-2.5 border-b border-mm-crd/65 pb-4">
                <div className="w-9 h-9 bg-mm-gbg/45 rounded-xl flex items-center justify-center text-mm-g">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-mm-g text-base">Historial de Actividad</h3>
                  <p className="text-[10px] text-mm-txw font-black uppercase tracking-wider">Línea de tiempo de cambios de estado</p>
                </div>
              </div>

              <div className="relative pl-6 border-l-2 border-mm-crd/60 space-y-6 ml-2">
                {order.history && order.history.length > 0 ? (
                  order.history.map((h, i) => {
                    const conf = getStatusConfig(h.status);
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
                        {/* Timeline Dot */}
                        <div className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 border-white ${
                          h.status === order.status ? 'bg-mm-g scale-125 ring-4 ring-mm-gbg' : 'bg-mm-crd'
                        }`} />

                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-mm-g">{conf.label}</span>
                              <span className="text-[10px] text-mm-txw font-semibold">
                                por {h.changedByName || 'Sistema'}
                              </span>
                            </div>
                            <div className="text-[10px] text-mm-txs font-semibold flex items-center gap-1">
                              <span>{itemDate}</span>
                              <span>{itemTime}</span>
                            </div>
                          </div>
                          {h.notes && (
                            <p className="text-xs text-mm-txs italic font-medium bg-slate-50 p-2.5 rounded-xl border border-mm-crd/40 mt-1 leading-relaxed">
                              "{h.notes}"
                            </p>
                          )}
                        </div>
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

          </div>

          {/* Right Column (Client Info, Billing Summary) - 5 cols */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Customer Details Card */}
            <div className="bg-white rounded-3xl border border-mm-crd p-6 shadow-sm">
              <div className="flex items-center gap-2.5 mb-6 border-b border-mm-crd/65 pb-4">
                <div className="w-9 h-9 bg-mm-gbg/45 rounded-xl flex items-center justify-center text-mm-g">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-mm-g text-base">Datos del Cliente</h3>
                  <p className="text-[10px] text-mm-txw font-black uppercase tracking-wider">Información de contacto</p>
                </div>
              </div>

              <div className="space-y-4 text-xs font-semibold text-mm-g">
                
                {/* Initials & Name */}
                <div className="flex items-center gap-3 pb-3 border-b border-mm-crd/30">
                  <div className="w-12 h-12 bg-mm-gbg text-mm-g font-black text-base rounded-2xl flex items-center justify-center border border-mm-crd shadow-inner">
                    {(order.buyerName || 'CL').substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-[10px] text-mm-txw font-black uppercase tracking-widest leading-none mb-1">Nombre Completo</p>
                    <p className="text-sm font-bold text-mm-g leading-tight">{order.buyerName || 'Cliente'}</p>
                  </div>
                </div>

                {/* Document */}
                {order.buyerDocument && (
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-mm-txw flex-shrink-0" />
                    <div>
                      <p className="text-[9px] text-mm-txw font-black uppercase tracking-wider leading-none mb-0.5">Identificación / Cédula</p>
                      <p className="text-xs text-mm-g font-bold">{order.buyerDocument}</p>
                    </div>
                  </div>
                )}

                {/* Phone */}
                {order.buyerPhone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-mm-txw flex-shrink-0" />
                    <div>
                      <p className="text-[9px] text-mm-txw font-black uppercase tracking-wider leading-none mb-0.5">Teléfono</p>
                      <a 
                        href={`tel:${order.buyerPhone}`} 
                        className="text-xs text-mm-g hover:text-mm-gm underline underline-offset-2 transition-colors font-bold"
                      >
                        {order.buyerPhone}
                      </a>
                    </div>
                  </div>
                )}

                {/* Email */}
                {order.buyerEmail && (
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-mm-txw flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[9px] text-mm-txw font-black uppercase tracking-wider leading-none mb-0.5">Correo Electrónico</p>
                      <a 
                        href={`mailto:${order.buyerEmail}`} 
                        className="text-xs text-mm-g hover:text-mm-gm underline underline-offset-2 transition-colors font-bold truncate block"
                      >
                        {order.buyerEmail}
                      </a>
                    </div>
                  </div>
                )}

                {/* Delivery Address */}
                <div className="flex items-start gap-3 pt-3 border-t border-mm-crd/30">
                  <MapPin className="w-4 h-4 text-mm-txw mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[9px] text-mm-txw font-black uppercase tracking-wider leading-none mb-1">Dirección de Entrega</p>
                    <p className="text-xs text-mm-txs font-medium leading-relaxed">{order.address}</p>
                  </div>
                </div>

              </div>
            </div>

            {/* Financial Summary & Payment */}
            <div className="bg-white rounded-3xl border border-mm-crd p-6 shadow-sm space-y-5">
              
              {/* Payment Info */}
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-mm-crd/40">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-mm-txw" />
                  <span className="text-[10px] text-mm-txw font-black uppercase tracking-wider">Pago</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-xs font-bold text-mm-g leading-tight">{order.paymentMethod}</span>
                  <span className={`text-[9px] font-black uppercase tracking-wider mt-0.5 ${
                    order.paymentStatus === 'approved' || order.paymentStatus === 'paid'
                      ? 'text-green-600' 
                      : 'text-amber-500'
                  }`}>
                    {order.paymentStatus === 'approved' || order.paymentStatus === 'paid' ? 'Aprobado' : 'Pendiente'}
                  </span>
                </div>
              </div>

              {/* Billing breakdown */}
              <div className="space-y-3 border-t border-mm-crd/40 pt-4 text-xs font-semibold text-mm-txw">
                <div className="flex justify-between">
                  <span>Subtotal Tienda</span>
                  <span className="text-mm-g font-bold">{fmt(order.subtotal || order.total)}</span>
                </div>
                
                {order.discount !== undefined && order.discount > 0 && (
                  <div className="flex justify-between text-red-500 font-bold">
                    <span>Descuento Aplicado</span>
                    <span>-{fmt(order.discount)}</span>
                  </div>
                )}

                {order.deliveryFee !== undefined && order.deliveryFee > 0 && (
                  <div className="flex justify-between">
                    <span>Costo de Envío</span>
                    <span className="text-mm-g font-bold">{fmt(order.deliveryFee)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center text-mm-g border-t border-mm-crd/40 pt-4">
                  <span className="text-sm font-bold">Total a Cobrar</span>
                  <span className="text-2xl font-black">{fmt(order.total)}</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-mm-crd/60 pt-6 flex flex-col sm:flex-row justify-end items-center gap-3">
          <Button
            variant="outline"
            size="md"
            onClick={onClose}
            className="w-full sm:w-auto rounded-2xl h-12 text-sm border-mm-crd text-mm-txw hover:bg-mm-gbg hover:text-mm-g transition-colors font-bold"
          >
            Cerrar Detalle
          </Button>
          
          {statusConfig.next && (
            <Button
              variant="primary"
              size="md"
              onClick={handleAction}
              className="w-full sm:w-auto rounded-2xl h-12 text-sm font-bold shadow-lg shadow-mm-g/10 bg-mm-g text-white hover:bg-mm-gm"
            >
              {statusConfig.action}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>

      </div>
    </Modal>
  );
}
