import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell, Loader2, Truck, CheckCircle2, XCircle, History,
  Clock, ClipboardList, TrendingUp, Package
} from 'lucide-react';
import { useOrders } from '../hooks/use-orders';
import { Button, Badge, cn } from '@/src/components/Shared';
import { fmt } from '@/src/constants';
import { Order, OrderStatus } from '@/src/types';
import { OrderDetailModal } from '@/src/features/orders/components/OrderDetailModal';
import { StatusNoteModal } from './status-note-modal';

export function OrdersView() {
  const {
    filteredOrders,
    filterStatus,
    setFilterStatus,
    stats,
    updateOrderStatus,
    stores,
    selectedStoreId,
    setSelectedStoreId,
  } = useOrders();

  const [currentPage, setCurrentPage] = React.useState(1);
  const [selectedOrderForDetail, setSelectedOrderForDetail] = React.useState<Order | null>(null);
  const [statusChangeRequest, setStatusChangeRequest] = React.useState<{
    orderId: string;
    nextStatus: OrderStatus;
    nextStatusLabel: string;
    actionLabel: string;
  } | null>(null);

  const ordersPerPage = 6;

  // Reset page to 1 if filter or store changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, selectedStoreId]);

  const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);
  const startIndex = (currentPage - 1) * ordersPerPage;
  const paginatedOrders = filteredOrders.slice(startIndex, startIndex + ordersPerPage);

  const getStatusConfig = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return {
          label: 'Nuevo',
          color: 'bg-mm-oro text-white',
          icon: Bell,
          action: 'Confirmar',
          next: 'confirmed' as const,
        };
      case 'confirmed':
        return {
          label: 'Confirmado',
          color: 'bg-indigo-600 text-white',
          icon: CheckCircle2,
          action: 'Preparar',
          next: 'packing' as const,
        };
      case 'paid':
        return {
          label: 'Pagado',
          color: 'bg-emerald-600 text-white',
          icon: CheckCircle2,
          action: 'Preparar',
          next: 'packing' as const,
        };
      case 'packing':
        return {
          label: 'Empacando',
          color: 'bg-blue text-white',
          icon: Loader2,
          action: 'Listo Recogida',
          next: 'at_collection' as const,
        };
      case 'at_collection':
        return {
          label: 'Listo Recogida',
          color: 'bg-purple-600 text-white',
          icon: ClipboardList,
          action: 'Despachar',
          next: 'dispatched' as const,
        };
      case 'dispatched':
        return {
          label: 'En Camino',
          color: 'bg-mm-g text-white',
          icon: Truck,
          action: 'Entregado',
          next: 'delivered' as const,
        };
      case 'delivered':
        return {
          label: 'Entregado',
          color: 'bg-mm-gbg text-mm-txs',
          icon: CheckCircle2,
          action: null,
          next: null,
        };
      case 'returned':
        return {
          label: 'Devuelto',
          color: 'bg-slate-500 text-white',
          icon: History,
          action: null,
          next: null,
        };
      default: // cancelled
        return {
          label: 'Cancelado',
          color: 'bg-r text-white',
          icon: XCircle,
          action: null,
          next: null,
        };
    }
  };

  const handleConfirmStatusChange = async (notes: string) => {
    if (statusChangeRequest) {
      await updateOrderStatus(
        statusChangeRequest.orderId,
        statusChangeRequest.nextStatus,
        notes
      );

      // Si el modal de detalle está abierto, actualizamos la orden seleccionada para refrescar el historial
      if (selectedOrderForDetail && selectedOrderForDetail.id === statusChangeRequest.orderId) {
        // Buscamos la orden actualizada en filteredOrders (la cual tendrá el nuevo historial tras refetch)
        const updated = filteredOrders.find(o => o.id === statusChangeRequest.orderId);
        if (updated) {
          // Asignamos el estado actualizado
          setSelectedOrderForDetail({
            ...updated,
            status: statusChangeRequest.nextStatus
          });
        }
      }

      setStatusChangeRequest(null);
    }
  };

  // Sincronizar el modal de detalle cuando cambian las órdenes en tiempo real
  React.useEffect(() => {
    if (selectedOrderForDetail) {
      const current = filteredOrders.find(o => o.id === selectedOrderForDetail.id);
      if (current) {
        setSelectedOrderForDetail(current);
      }
    }
  }, [filteredOrders, selectedOrderForDetail?.id]);

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-fraunces text-mm-g mb-2">Monitor de Pedidos</h1>
          <p className="text-mm-txs">Gestiona el flujo de trabajo de tu tienda en tiempo real.</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {stores.length > 1 && (
            <div className="flex flex-col gap-1 min-w-[200px]">
              <label className="text-[10px] font-black uppercase tracking-widest text-mm-txw">Filtrar por Tienda</label>
              <select
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="bg-white text-mm-g font-semibold text-sm border border-mm-crd rounded-xl px-4 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-mm-g/20 cursor-pointer"
              >
                <option value="all">Todas las tiendas</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1 min-w-[200px]">
            <label className="text-[10px] font-black uppercase tracking-widest text-mm-txw">Filtrar por Estado</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="bg-white text-mm-g font-semibold text-sm border border-mm-crd rounded-xl px-4 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-mm-g/20 cursor-pointer"
            >
              <option value="all">Todos los estados</option>
              <option value="pending">Nuevo</option>
              <option value="confirmed">Confirmado</option>
              <option value="paid">Pagado</option>
              <option value="packing">Empacando</option>
              <option value="at_collection">Listo Recojo</option>
              <option value="dispatched">En Ruta</option>
              <option value="delivered">Entregado</option>
              <option value="cancelled">Cancelado</option>
              <option value="returned">Devuelto</option>
            </select>
          </div>
        </div>
      </div>

      {/* Live Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6">
        {[
          { label: 'Nuevo', val: stats.pending, color: 'mm-oro', icon: Bell },
          { label: 'Confirmado', val: stats.confirmed, color: 'indigo', icon: CheckCircle2 },
          { label: 'Pagado', val: stats.paid, color: 'emerald', icon: ClipboardList },
          { label: 'Empacando', val: stats.packing, color: 'blue', icon: Package },
          { label: 'Listo Recojo', val: stats.at_collection, color: 'purple', icon: ClipboardList },
          { label: 'En Camino', val: stats.dispatched, color: 'mm-g', icon: Truck },
          { label: 'Entregado', val: stats.delivered, color: 'green', icon: CheckCircle2 },
          { label: 'Cancelado', val: stats.cancelled, color: 'red', icon: XCircle },
          { label: 'Devuelto', val: stats.returned, color: 'slate', icon: History },
          { label: 'Pedidos Hoy', val: stats.totalToday, color: 'mm-txw', icon: History },
        ].map((item, i) => (
          <div key={i} className="bg-white p-5 rounded-[24px] border border-mm-crd shadow-sm flex items-center gap-3.5 hover:shadow-md transition-shadow">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm",
              item.color === 'mm-oro' ? 'bg-mm-orl text-mm-oro border border-mm-oro/10' :
                item.color === 'indigo' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' :
                  item.color === 'emerald' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                    item.color === 'blue' ? 'bg-bluel text-blue border border-blue/10' :
                      item.color === 'purple' ? 'bg-purple-50 text-purple-600 border border-purple-100' :
                        item.color === 'mm-g' ? 'bg-mm-gbg text-mm-g border border-mm-g/10' :
                          item.color === 'green' ? 'bg-green-50 text-green-600 border border-green-100' :
                            item.color === 'red' ? 'bg-red-50 text-red-600 border border-red-100' :
                              item.color === 'slate' ? 'bg-slate-100 text-slate-600 border border-slate-200' : 'bg-mm-crd/20 text-mm-txw border border-mm-crd/35'
            )}>
              <item.icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold text-mm-g leading-tight">{item.val}</p>
              <p className="text-[9px] font-black uppercase tracking-wider text-mm-txw truncate">{item.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Order Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <AnimatePresence mode="popLayout">
          {paginatedOrders.map(order => {
            const config = getStatusConfig(order.status);
            return (
              <motion.div
                key={order.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white rounded-[40px] border border-mm-crd shadow-sm overflow-hidden flex flex-col group hover:shadow-xl transition-all duration-500"
              >
                <div className="p-8 pb-4 relative">
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-14 h-14 bg-mm-gbg rounded-2xl flex items-center justify-center text-3xl shadow-inner border border-mm-crd">
                      📦
                    </div>
                    <Badge className={cn("px-4 py-1 rounded-xl font-black uppercase text-[10px] tracking-widest", config.color)}>
                      {config.label}
                    </Badge>
                  </div>
                  <h3 className="text-xl font-bold text-mm-g mb-1">Pedido #{order.storeOrderId.substring(0, 8)}</h3>
                  <div className="flex flex-wrap items-center gap-2.5 text-xs text-mm-txs">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3" /> {new Date(order.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {stores.length > 1 && (
                      <span className="bg-mm-gbg text-mm-g px-2 py-0.5 rounded-lg text-[10px] font-extrabold border border-mm-crd/50">
                        🏪 {order.storeName}
                      </span>
                    )}
                  </div>
                  <div className="absolute top-8 right-16 opacity-0 group-hover:opacity-10 shadow-2xl transition-opacity">
                    <TrendingUp className="w-24 h-24 text-mm-g -rotate-12" />
                  </div>
                </div>

                <div className="px-8 flex-grow space-y-4">
                  <div className="bg-mm-gbg/30 p-4 rounded-3xl border border-mm-crd/50">
                    <p className="text-[10px] font-black text-mm-txw uppercase tracking-widest mb-3">Contenido</p>
                    <div className="space-y-2">
                      {order.items.slice(0, 3).map((item, idx) => (
                        <div key={idx} className="flex justify-between text-xs font-bold text-mm-g">
                          <span className="truncate pr-4">{item.qty}{item.unit} {item.name}</span>
                          <span className="shrink-0">{fmt(item.price * item.qty)}</span>
                        </div>
                      ))}
                      {order.items.length > 3 && (
                        <p className="text-[10px] text-mm-txw font-bold italic">+{order.items.length - 3} productos más...</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 px-1">
                    <div className="w-8 h-8 rounded-full bg-mm-gbg flex items-center justify-center text-[10px] font-black border border-mm-crd">
                      {order.buyerId.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-[10px] font-black text-mm-txw uppercase tracking-widest leading-none mb-1">Entregar en</p>
                      <p className="text-[11px] text-mm-txs truncate font-medium">{order.address}</p>
                    </div>
                  </div>
                </div>

                <div className="p-8 pt-6 mt-4 border-t border-mm-crd/50 flex items-center justify-between bg-mm-gbg/10">
                  <div>
                    <p className="text-[10px] font-black text-mm-txw uppercase tracking-widest mb-1">Valor Total</p>
                    <p className="text-xl font-bold text-mm-g">{fmt(order.total)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl px-4 h-10 border border-mm-crd text-mm-txs hover:bg-mm-gbg hover:text-mm-g transition-colors font-bold"
                      onClick={() => setSelectedOrderForDetail(order)}
                    >
                      Ver Detalle
                    </Button>
                    {config.next && (
                      <Button
                        size="sm"
                        className="rounded-xl px-5 h-10 shadow-lg shadow-mm-g/10"
                        onClick={() => setStatusChangeRequest({
                          orderId: order.id,
                          nextStatus: config.next!,
                          nextStatusLabel: getStatusConfig(config.next!).label,
                          actionLabel: config.action!
                        })}
                      >
                        {config.action}
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {filteredOrders.length === 0 && (
          <div className="col-span-full py-32 text-center opacity-30">
            <ClipboardList className="w-32 h-32 mx-auto mb-6" />
            <h3 className="text-2xl font-fraunces">Bandeja de Entrada Vacía</h3>
            <p className="max-w-xs mx-auto mt-2 italic font-medium">Los nuevos pedidos aparecerán aquí automáticamente.</p>
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white px-8 py-5 rounded-[32px] border border-mm-crd shadow-sm mt-8">
          <span className="text-sm text-mm-txs">
            Página <span className="font-bold text-mm-g">{currentPage}</span> de <span className="font-bold text-mm-g">{totalPages}</span>
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage <= 1}
              className="rounded-xl px-5 h-10 border border-mm-crd text-mm-txs hover:bg-mm-gbg hover:text-mm-g transition-colors font-bold disabled:opacity-50"
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage >= totalPages}
              className="rounded-xl px-5 h-10 border border-mm-crd text-mm-txs hover:bg-mm-gbg hover:text-mm-g transition-colors font-bold disabled:opacity-50"
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <OrderDetailModal
        isOpen={!!selectedOrderForDetail}
        onClose={() => setSelectedOrderForDetail(null)}
        order={selectedOrderForDetail}
        onStartStatusChange={(orderId, status, nextStatusLabel, actionLabel) => setStatusChangeRequest({
          orderId,
          nextStatus: status,
          nextStatusLabel,
          actionLabel
        })}
      />

      {/* Status Note Prompt Modal */}
      <StatusNoteModal
        isOpen={!!statusChangeRequest}
        onClose={() => setStatusChangeRequest(null)}
        onConfirm={handleConfirmStatusChange}
        title="Cambiar Estado del Pedido"
        actionLabel={statusChangeRequest?.actionLabel || 'Confirmar'}
        nextStatusLabel={statusChangeRequest?.nextStatusLabel || ''}
      />
    </div>
  );
}
