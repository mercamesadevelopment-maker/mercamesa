import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../store';
import { AppNotification } from '../types';
import { fmt } from '../constants';
import { Button, Badge, cn } from './Shared';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  Map as MapIcon, Navigation, CheckCircle2, Clock, 
  MapPin, User, Package, TrendingUp, Bell, Check,
  Trash2, AlertCircle, ShoppingBag, CreditCard, Star
} from 'lucide-react';

export function DeliveryView() {
  const { state, dispatch } = useApp();
  const [activeDelivery, setActiveDelivery] = useState(0);
  const [isRoutActive, setIsRouteActive] = useState(false);
  const [position, setPosition] = useState({ x: 50, y: 50 });

  // Filter orders that are not delivered or cancelled
  const activeOrders = state.orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled');

  // Map orders to delivery format
  const deliveries = activeOrders.map((o, i) => ({
    id: o.id,
    name: `Orden ${o.id}`,
    address: o.address,
    items: o.items.reduce((acc, item) => acc + item.qty, 0),
    dist: `${(1 + i * 0.8).toFixed(1)} km`,
    status: o.status,
    coords: { x: 20 + (i * 25) % 60, y: 30 + (i * 20) % 50 }
  }));

  useEffect(() => {
    if (isRoutActive && deliveries.length > 0 && activeDelivery < deliveries.length) {
      const target = deliveries[activeDelivery].coords;
      const interval = setInterval(() => {
        setPosition(prev => ({
          x: prev.x + (target.x - prev.x) * 0.05,
          y: prev.y + (target.y - prev.y) * 0.05,
        }));
      }, 50);
      return () => clearInterval(interval);
    }
  }, [isRoutActive, activeDelivery, deliveries]);

  if (deliveries.length === 0) {
    return (
      <div className="p-6 lg:p-10 max-w-7xl mx-auto h-[calc(100vh-120px)] flex flex-col items-center justify-center bg-white rounded-[40px] border border-mm-crd shadow-sm">
        <div className="text-8xl mb-6">📦</div>
        <h2 className="text-3xl font-fraunces text-mm-g mb-2">No hay pedidos pendientes</h2>
        <p className="text-mm-txs text-center max-w-md">
          ¡Buen trabajo! Has completado todas tus entregas por hoy. Vuelve pronto para ver nuevos pedidos.
        </p>
      </div>
    );
  }

  const currentDelivery = deliveries[activeDelivery] || deliveries[0];

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto h-[calc(100vh-120px)] flex flex-col lg:flex-row gap-8">
      {/* Map Area */}
      <div className="flex-grow bg-[#0D1117] rounded-[40px] border border-mm-crd shadow-2xl relative overflow-hidden">
        {/* SVG Map Background */}
        <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 100 100">
          <path d="M0 20 H100 M0 40 H100 M0 60 H100 M0 80 H100" stroke="#21262D" strokeWidth="0.5" />
          <path d="M20 0 V100 M40 0 V100 M60 0 V100 M80 0 V100" stroke="#21262D" strokeWidth="0.5" />
          <path d="M10 10 L90 90 M90 10 L10 90" stroke="#21262D" strokeWidth="0.3" />
        </svg>

        {/* Delivery Points */}
        {deliveries.map((d, i) => (
          <motion.div
            key={d.id}
            className="absolute w-10 h-10 -ml-5 -mt-5 flex items-center justify-center z-10"
            style={{ left: `${d.coords.x}%`, top: `${d.coords.y}%` }}
          >
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 shadow-lg transition-all",
              activeDelivery === i ? "bg-mm-oro border-white text-mm-g scale-125" : "bg-white border-mm-crd text-mm-txs"
            )}>
              {i + 1}
            </div>
            {activeDelivery === i && (
              <div className="absolute -top-10 bg-white px-3 py-1 rounded-lg shadow-xl text-[10px] font-bold text-mm-g whitespace-nowrap animate-fade-up">
                {d.name}
              </div>
            )}
          </motion.div>
        ))}

        {/* Delivery Person */}
        <motion.div
          className="absolute w-12 h-12 -ml-6 -mt-6 z-20"
          animate={{ left: `${position.x}%`, top: `${position.y}%` }}
        >
          <div className="w-full h-full bg-mm-g rounded-full flex items-center justify-center text-2xl border-4 border-white shadow-2xl relative">
            🚴
            <div className="absolute inset-0 bg-mm-g rounded-full animate-ping opacity-20" />
          </div>
        </motion.div>

        {/* Map UI */}
        <div className="absolute bottom-8 left-8 right-8 flex justify-between items-end pointer-events-none">
          <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 text-white pointer-events-auto">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Siguiente parada</p>
            <p className="text-lg font-bold">{currentDelivery.address}</p>
            <p className="text-xs opacity-80">{currentDelivery.dist} • {currentDelivery.name}</p>
          </div>
          <Button 
            size="lg" 
            className="pointer-events-auto shadow-2xl"
            onClick={() => setIsRouteActive(!isRoutActive)}
          >
            <Navigation className={cn("w-5 h-5", isRoutActive && "animate-pulse")} />
            {isRoutActive ? 'En ruta...' : 'Iniciar ruta'}
          </Button>
        </div>
      </div>

      {/* Side Panel */}
      <div className="w-full lg:w-96 shrink-0 flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-3xl border border-mm-crd shadow-sm">
            <p className="text-[10px] text-mm-txw font-bold uppercase tracking-widest mb-1">Entregas</p>
            <p className="text-2xl font-bold text-mm-g">{state.orders.filter(o => o.status === 'delivered').length} / {state.orders.length}</p>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-mm-crd shadow-sm">
            <p className="text-[10px] text-mm-txw font-bold uppercase tracking-widest mb-1">Ganancia</p>
            <p className="text-2xl font-bold text-ok">{fmt(state.orders.filter(o => o.status === 'delivered').length * 5000)}</p>
          </div>
        </div>

        <div className="flex-grow bg-white rounded-[40px] border border-mm-crd shadow-sm flex flex-col overflow-hidden">
          <div className="p-6 border-b border-mm-crd">
            <h3 className="text-xl font-fraunces text-mm-g">Lista de Entregas</h3>
          </div>
          <div className="flex-grow overflow-y-auto p-4 space-y-3 scrollbar-hide">
            {deliveries.map((d, i) => (
              <div 
                key={d.id}
                onClick={() => setActiveDelivery(i)}
                className={cn(
                  "p-4 rounded-2xl border transition-all cursor-pointer",
                  activeDelivery === i ? "bg-mm-gbg border-mm-g" : "bg-white border-mm-crd hover:border-mm-gll"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-mm-g text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                      {i + 1}
                    </div>
                    <span className="font-bold text-sm text-mm-g">{d.name}</span>
                  </div>
                  <Badge variant="info" className="text-[10px]">{d.dist}</Badge>
                </div>
                <p className="text-xs text-mm-txs mb-3 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {d.address}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-mm-txw uppercase">{d.items} productos</span>
                  {activeDelivery === i && (
                    <Button 
                      size="sm" 
                      className="h-8 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        dispatch({ type: 'UPDATE_ORDER_STATUS', orderId: d.id, status: 'delivered' });
                        if (activeDelivery >= deliveries.length - 1) {
                          setActiveDelivery(0);
                        }
                      }}
                    >
                      Entregado
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function EarningsView() {
  const { state } = useApp();
  const deliveredOrders = state.orders.filter(o => o.status === 'delivered');
  const totalEarnings = deliveredOrders.length * 5000; // Demo: 5000 per delivery
  const tips = deliveredOrders.length * 1200; // Demo: 1200 tips avg

  const earningsData = [
    { day: 'Lun', e: 45000 },
    { day: 'Mar', e: 52000 },
    { day: 'Mié', e: 38000 },
    { day: 'Jue', e: 61000 },
    { day: 'Vie', e: 75000 },
    { day: 'Sáb', e: 82000 },
    { day: 'Hoy', e: 42000 },
  ];

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-fraunces text-mm-g mb-2">Mis Ganancias</h1>
        <p className="text-mm-txs">Resumen de tus ingresos por entregas realizadas.</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[32px] border border-mm-crd shadow-sm">
          <p className="text-xs text-mm-txw font-bold uppercase tracking-widest mb-2">Balance Total</p>
          <p className="text-4xl font-fraunces text-mm-g">{fmt(totalEarnings + tips)}</p>
          <p className="text-xs text-ok font-bold mt-2">↑ 12% vs semana pasada</p>
        </div>
        <div className="bg-white p-8 rounded-[32px] border border-mm-crd shadow-sm">
          <p className="text-xs text-mm-txw font-bold uppercase tracking-widest mb-2">Entregas</p>
          <p className="text-4xl font-fraunces text-mm-g">{deliveredOrders.length}</p>
          <p className="text-xs text-mm-txw mt-2">Promedio: 8.5/día</p>
        </div>
        <div className="bg-white p-8 rounded-[32px] border border-mm-crd shadow-sm">
          <p className="text-xs text-mm-txw font-bold uppercase tracking-widest mb-2">Propinas</p>
          <p className="text-4xl font-fraunces text-mm-g">{fmt(tips)}</p>
          <p className="text-xs text-mm-txw mt-2">Agradecimiento de clientes</p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[40px] border border-mm-crd shadow-sm">
        <h3 className="text-xl font-fraunces text-mm-g mb-8">Ingresos Diarios</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={earningsData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8E8DC" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#5C6B4A', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#5C6B4A', fontSize: 12 }} tickFormatter={(v) => `$${v/1000}k`} />
              <Tooltip />
              <Bar dataKey="e" fill="#3E7023" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export function NotifsView() {
  const { state, dispatch } = useApp();

  const getNotifIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'order_new': return { icon: ShoppingBag, color: 'bg-bluel text-blue' };
      case 'price_update': return { icon: TrendingUp, color: 'bg-mm-orl text-mm-oro' };
      case 'rating': return { icon: Star, color: 'bg-warnl text-warn' };
      case 'payment': return { icon: CreditCard, color: 'bg-okl text-ok' };
    }
  };

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-fraunces text-mm-g mb-2">Notificaciones</h1>
          <p className="text-mm-txs">Mantente al día con lo que pasa en tu cuenta.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => dispatch({ type: 'READ_ALL_NOTIFS' })}>
          <Check className="w-4 h-4" /> Marcar todo como leído
        </Button>
      </div>

      <div className="space-y-4">
        {state.notifs.length === 0 ? (
          <div className="bg-white p-12 rounded-[32px] border border-mm-crd text-center opacity-40">
            <div className="text-7xl mb-4">🔔</div>
            <p className="text-xl font-fraunces">No tienes notificaciones</p>
          </div>
        ) : (
          state.notifs.map(notif => {
            const { icon: Icon, color } = getNotifIcon(notif.type);
            return (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => dispatch({ type: 'READ_NOTIF', notifId: notif.id })}
                className={cn(
                  "bg-white p-6 rounded-3xl border border-mm-crd shadow-sm flex gap-6 cursor-pointer transition-all hover:shadow-md relative overflow-hidden",
                  !notif.read && "border-l-4 border-l-mm-g bg-mm-gbg/20"
                )}
              >
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shrink-0", color)}>
                  <Icon className="w-7 h-7" />
                </div>
                <div className="flex-grow">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-bold text-mm-g">{notif.title}</h4>
                    <span className="text-[10px] text-mm-txw font-bold uppercase">{notif.time}</span>
                  </div>
                  <p className="text-sm text-mm-txs leading-relaxed">{notif.msg}</p>
                </div>
                {!notif.read && (
                  <div className="absolute top-4 right-4 w-2 h-2 bg-mm-g rounded-full" />
                )}
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
