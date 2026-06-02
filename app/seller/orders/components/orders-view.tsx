import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, Loader2, Truck, CheckCircle2, XCircle, History, 
  Clock, ClipboardList, TrendingUp, Package 
} from 'lucide-react';
import { useOrders } from '../hooks/use-orders';
import { Button, Badge, cn } from '@/src/components/Shared';
import { fmt } from '@/src/constants';
import { Order } from '@/src/types';

export function OrdersView() {
  const {
    filteredOrders,
    filterStatus,
    setFilterStatus,
    stats,
    updateOrderStatus,
  } = useOrders();

  const getStatusConfig = (status: Order['status']) => {
    switch (status) {
      case 'pending': 
        return { 
          label: 'Nuevo', 
          color: 'bg-mm-oro text-white', 
          icon: Bell, 
          action: 'Preparar', 
          next: 'preparing' as const 
        };
      case 'preparing': 
        return { 
          label: 'Preparando', 
          color: 'bg-blue text-white', 
          icon: Loader2, 
          action: 'Despachar', 
          next: 'on_the_way' as const 
        };
      case 'on_the_way': 
        return { 
          label: 'En Camino', 
          color: 'bg-mm-g text-white', 
          icon: Truck, 
          action: 'Entregado', 
          next: 'delivered' as const 
        };
      case 'delivered': 
        return { 
          label: 'Entregado', 
          color: 'bg-mm-gbg text-mm-txs', 
          icon: CheckCircle2, 
          action: null, 
          next: null 
        };
      default: 
        return { 
          label: 'Cancelado', 
          color: 'bg-r text-white', 
          icon: XCircle, 
          action: null, 
          next: null 
        };
    }
  };

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-fraunces text-mm-g mb-2">Monitor de Pedidos</h1>
          <p className="text-mm-txs">Gestiona el flujo de trabajo de tu tienda en tiempo real.</p>
        </div>
        <div className="flex gap-2 bg-mm-gbg/50 p-1.5 rounded-2xl border border-mm-crd shadow-inner">
          {(['all', 'pending', 'preparing', 'on_the_way'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all uppercase tracking-widest",
                filterStatus === s ? "bg-white text-mm-g shadow-sm border border-mm-crd" : "text-mm-txw hover:text-mm-g"
              )}
            >
              {s === 'all' ? 'Todos' : s === 'on_the_way' ? 'Ruta' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Live Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Ingresando', val: stats.pending, color: 'mm-oro', icon: Bell },
          { label: 'En Cocina/Prep', val: stats.preparing, color: 'blue', icon: Package },
          { label: 'En Reparto', val: stats.dispatch, color: 'mm-g', icon: Truck },
          { label: 'Pedidos Hoy', val: stats.totalToday, color: 'mm-txw', icon: History },
        ].map((item, i) => (
          <div key={i} className="bg-white p-6 rounded-[32px] border border-mm-crd shadow-sm flex items-center gap-4">
             <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", 
               item.color === 'mm-oro' ? 'bg-mm-orl text-mm-oro' : 
               item.color === 'blue' ? 'bg-bluel text-blue' : 
               item.color === 'mm-g' ? 'bg-mm-gbg text-mm-g' : 'bg-mm-crd/20 text-mm-txw'
             )}>
                <item.icon className="w-6 h-6" />
             </div>
             <div>
                <p className="text-2xl font-bold text-mm-g">{item.val}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-mm-txw">{item.label}</p>
             </div>
          </div>
        ))}
      </div>

      {/* Order Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <AnimatePresence mode="popLayout">
          {filteredOrders.map(order => {
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
                  <h3 className="text-xl font-bold text-mm-g mb-1">Pedido #{order.id}</h3>
                  <p className="text-xs text-mm-txs flex items-center gap-1.5">
                    <Clock className="w-3 h-3" /> {new Date(order.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
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
                  {config.next && (
                    <Button 
                      size="sm" 
                      className="rounded-xl px-5 h-10 shadow-lg shadow-mm-g/10"
                      onClick={() => updateOrderStatus(order.id, config.next!)}
                    >
                      {config.action}
                    </Button>
                  )}
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
    </div>
  );
}
