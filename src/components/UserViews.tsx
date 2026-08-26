import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../store';
import { Order, StoreReview } from '../types';
import { fmt } from '../constants';
import { formatOrderCode } from '../features/orders/utils/orderCode';
import { Button, cn } from './Shared';
import {
  ClipboardList, Package, Truck, CheckCircle2, XCircle,
  Clock, MapPin, CreditCard, Star,
  Send, Smile, Paperclip, MoreVertical,
  Image as ImageIcon, X
} from 'lucide-react';

export function OrdersView() {
  const { state, dispatch } = useApp();
  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'cancelled'>('active');
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [ratingStoreId, setRatingStoreId] = useState<number | string | null>(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState('');

  const handleOpenRating = (storeId: number | string) => {
    setRatingStoreId(storeId);
    setRatingValue(5);
    setRatingComment('');
    setIsRatingModalOpen(true);
  };

  const handleSaveRating = () => {
    if (!ratingStoreId) return;

    const newReview: StoreReview = {
      id: Math.random().toString(36).substr(2, 9),
      storeId: ratingStoreId,
      buyerId: state.buyerProfile.email,
      buyerName: state.buyerProfile.name,
      stars: ratingValue,
      comment: ratingComment,
      date: new Date().toISOString()
    };

    dispatch({ type: 'ADD_REVIEW', review: newReview });

    dispatch({
      type: 'ADD_NOTIF',
      notif: {
        id: Math.random().toString(36).substr(2, 9),
        type: 'rating',
        title: 'Â¡Gracias por calificar!',
        msg: `Tu opiniÃ³n sobre la tienda ha sido enviada con Ã©xito.`,
        time: 'Ahora',
        read: false
      }
    });

    setIsRatingModalOpen(false);
  };

  const isProvider = state.userRole === 'provider';
  const isDelivery = state.userRole === 'delivery';
  const myStoreId = state.stores[0].id;

  const filteredOrders = state.orders.filter(o => {
    // Filter by role
    if (isProvider && o.storeId !== myStoreId) return false;

    // Filter by status tab
    if (activeTab === 'active') return ['pending', 'preparing', 'on_the_way'].includes(o.status);
    if (activeTab === 'completed') return o.status === 'delivered';
    return o.status === 'cancelled';
  });

  const getStatusInfo = (status: Order['status']) => {
    switch (status) {
      case 'pending': return { label: 'Pendiente', color: 'bg-warnl text-warn', icon: Clock };
      case 'preparing': return { label: 'Preparando', color: 'bg-bluel text-blue', icon: Package };
      case 'on_the_way': return { label: 'En camino', color: 'bg-purple-100 text-purple-600', icon: Truck };
      case 'delivered': return { label: 'Entregado', color: 'bg-okl text-ok', icon: CheckCircle2 };
      case 'cancelled': return { label: 'Anulado', color: 'bg-rl text-r', icon: XCircle };
    }
  };

  const title = isProvider ? 'Pedidos de mi Tienda' : isDelivery ? 'Historial de Entregas' : 'Mis Pedidos';
  const subtitle = isProvider ? 'Gestiona los pedidos que recibes de tus clientes.' : isDelivery ? 'Revisa tus entregas pasadas y ganancias.' : 'Sigue el estado de tus compras en tiempo real.';

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-fraunces text-mm-g mb-2">{title}</h1>
          <p className="text-mm-txs">{subtitle}</p>
        </div>
        <div className="flex bg-white p-1 rounded-2xl border border-mm-crd shadow-sm self-start">
          {(['active', 'completed', 'cancelled'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-6 py-2 rounded-xl text-sm font-bold transition-all capitalize",
                activeTab === tab ? "bg-mm-g text-white shadow-md" : "text-mm-txs hover:bg-mm-gbg"
              )}
            >
              {tab === 'active' ? 'Activos' : tab === 'completed' ? 'Completados' : 'Anulados'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-6 mb-10">
        <div className="bg-white p-6 rounded-3xl border border-mm-crd shadow-sm">
          <p className="text-xs text-mm-txw font-bold uppercase tracking-widest mb-2">Total pedidos</p>
          <p className="text-3xl font-fraunces text-mm-g">{isProvider ? state.orders.filter(o => o.storeId === myStoreId).length : state.orders.length}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-mm-crd shadow-sm">
          <p className="text-xs text-mm-txw font-bold uppercase tracking-widest mb-2">{isProvider ? 'Ventas totales' : 'Gasto total'}</p>
          <p className="text-3xl font-fraunces text-mm-g">
            {fmt(state.orders.filter(o => !isProvider || o.storeId === myStoreId).reduce((acc, o) => acc + o.total, 0))}
          </p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-mm-crd shadow-sm">
          <p className="text-xs text-mm-txw font-bold uppercase tracking-widest mb-2">Esta semana</p>
          <p className="text-3xl font-fraunces text-mm-g">
            {state.orders.filter(o => (!isProvider || o.storeId === myStoreId) && new Date(o.date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {filteredOrders.length === 0 ? (
          <div className="bg-white p-12 rounded-[32px] border border-mm-crd text-center opacity-40 flex flex-col items-center">
            <ClipboardList className="w-20 h-20 text-mm-txw mb-4" />
            <p className="text-xl font-fraunces">No hay pedidos {activeTab === 'active' ? 'activos' : activeTab === 'completed' ? 'completados' : 'anulados'}</p>
          </div>
        ) : (
          filteredOrders.map(order => {
            const status = getStatusInfo(order.status);
            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-[32px] border border-mm-crd shadow-sm overflow-hidden"
              >
                <div className="p-6 border-b border-mm-crd flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-mm-gbg rounded-2xl flex items-center justify-center overflow-hidden border border-mm-crd shadow-inner">
                      <img src={"https://picsum.photos/seed/store/100/100"} alt={order.storeName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div>
                      <h3 className="font-bold text-mm-g">{order.storeName}</h3>
                      <p className="text-xs text-mm-txw">Pedido {formatOrderCode(order.code, order.storeOrderId)} â€¢ {new Date(order.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className={cn("px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2", status.color)}>
                    <status.icon className="w-4 h-4" /> {status.label}
                  </div>
                </div>

                <div className="p-6 grid md:grid-cols-2 gap-8">
                  <div>
                    <p className="text-xs text-mm-txw font-bold uppercase tracking-widest mb-4">Productos</p>
                    <div className="space-y-3">
                      {order.items.map(item => (
                        <div key={item.id} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-mm-gbg rounded-lg flex items-center justify-center text-lg overflow-hidden shrink-0 border border-mm-crd/50">
                              {item.image ? (
                                <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                              ) : (
                                <ImageIcon className="w-4 h-4 text-mm-txw" />
                              )}
                            </div>
                            <span className="text-mm-txs font-medium">{item.qty}x {item.name}</span>
                          </div>
                          <span className="font-bold text-mm-g">{fmt(item.price * item.qty)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-mm-txw shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-mm-txw font-bold uppercase tracking-widest">Entrega en</p>
                        <p className="text-sm text-mm-txs">{order.address}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CreditCard className="w-5 h-5 text-mm-txw shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-mm-txw font-bold uppercase tracking-widest">MÃ©todo de pago</p>
                        <p className="text-sm text-mm-txs">{order.paymentMethod}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-mm-gbg/30 border-t border-mm-crd flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs text-mm-txw font-bold uppercase tracking-widest">Total {isProvider ? 'Venta' : 'Pagado'}</span>
                    <span className="text-2xl font-fraunces text-mm-g">{fmt(order.total)}</span>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" size="sm">Ver factura</Button>
                    {isProvider && order.status === 'pending' && (
                      <Button size="sm" onClick={() => dispatch({ type: 'UPDATE_ORDER_STATUS', orderId: order.id, status: 'preparing' })}>Aceptar Pedido</Button>
                    )}
                    {isProvider && order.status === 'preparing' && (
                      <Button size="sm" onClick={() => dispatch({ type: 'UPDATE_ORDER_STATUS', orderId: order.id, status: 'on_the_way' })}>Listo para Entrega</Button>
                    )}
                    {!isProvider && order.status === 'delivered' && (
                      <Button size="sm" onClick={() => handleOpenRating(order.storeId)}>Calificar</Button>
                    )}
                    {!isProvider && order.status === 'pending' && <Button variant="danger" size="sm">Cancelar</Button>}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      <AnimatePresence>
        {isRatingModalOpen && ratingStoreId && (
          <div className="fixed inset-0 z-[155] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsRatingModalOpen(false)}
              className="absolute inset-0 bg-mm-g/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-[40px] shadow-2xl overflow-hidden max-w-lg w-full p-10 text-center"
            >
              <button
                onClick={() => setIsRatingModalOpen(false)}
                className="absolute top-6 right-6 p-2 hover:bg-mm-gbg rounded-full transition-colors z-10"
              >
                <X className="w-6 h-6 text-mm-txs" />
              </button>

              <div className="w-24 h-24 bg-mm-gbg rounded-3xl flex items-center justify-center text-5xl mx-auto mb-6 shadow-sm border border-mm-crd/50">
                {state.stores.find(s => String(s.id) === String(ratingStoreId))?.emoji}
              </div>

              <h2 className="text-3xl font-fraunces text-mm-g mb-2">
                Â¿QuÃ© tal tu compra?
              </h2>
              <p className="text-mm-txs mb-8 font-medium">Califica a <span className="text-mm-g font-bold">{state.stores.find(s => String(s.id) === String(ratingStoreId))?.name}</span></p>

              <div className="flex justify-center gap-2 mb-8">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRatingValue(star)}
                    className="p-1 focus:outline-none transition-transform active:scale-90"
                  >
                    <Star
                      className={cn(
                        "w-10 h-10 transition-colors",
                        star <= ratingValue ? "fill-mm-oro text-mm-oro" : "text-mm-crd"
                      )}
                    />
                  </button>
                ))}
              </div>

              <div className="space-y-4 mb-8">
                <textarea
                  value={ratingComment}
                  onChange={e => setRatingComment(e.target.value)}
                  placeholder="CuÃ©ntanos mÃ¡s sobre los productos..."
                  className="w-full bg-mm-gbg/50 rounded-2xl p-6 text-sm outline-none border-1.5 border-transparent focus:border-mm-gll focus:bg-white transition-all min-h-[120px] resize-none"
                />
              </div>

              <div className="flex gap-4">
                <Button variant="outline" className="flex-1" onClick={() => setIsRatingModalOpen(false)}>
                  Cancelar
                </Button>
                <Button className="flex-1" onClick={handleSaveRating}>
                  Enviar ReseÃ±a
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}


export function SupportChatView() {
  const [messages, setMessages] = useState([
    { id: 1, text: "Â¡Hola! Bienvenido al soporte de MercaMesa. ðŸŒ¿", sender: 'bot', time: '10:00 AM' },
    { id: 2, text: "Â¿En quÃ© podemos ayudarte hoy?", sender: 'bot', time: '10:00 AM' },
  ]);
  const [input, setInput] = useState('');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = { id: Date.now(), text: input, sender: 'user', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setMessages([...messages, userMsg]);
    setInput('');

    setTimeout(() => {
      const botMsg = { id: Date.now() + 1, text: "Estamos revisando tu solicitud. Un agente se conectarÃ¡ pronto.", sender: 'bot', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
      setMessages(prev => [...prev, botMsg]);
    }, 1000);
  };

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto h-[calc(100vh-120px)] flex flex-col">
      <div className="bg-white p-6 rounded-t-[32px] border-x border-t border-mm-crd shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-mm-g rounded-full flex items-center justify-center text-2xl">ðŸŒ¿</div>
          <div>
            <h2 className="font-bold text-mm-g">Soporte MercaMesa</h2>
            <p className="text-xs text-ok font-bold flex items-center gap-1">
              <span className="w-2 h-2 bg-ok rounded-full animate-pulse" /> En lÃ­nea ahora
            </p>
          </div>
        </div>
        <button className="p-2 hover:bg-mm-gbg rounded-full transition-colors">
          <MoreVertical className="w-6 h-6 text-mm-txs" />
        </button>
      </div>

      <div className="flex-grow bg-[#F0F2F5] border-x border-mm-crd overflow-y-auto p-6 space-y-4 scrollbar-hide">
        {messages.map(msg => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className={cn(
              "max-w-[80%] p-4 rounded-2xl text-sm shadow-sm relative",
              msg.sender === 'user'
                ? "bg-mm-gll text-mm-g ml-auto rounded-tr-none"
                : "bg-white text-mm-txs mr-auto rounded-tl-none"
            )}
          >
            {msg.text}
            <span className="block text-[10px] mt-1 opacity-50 text-right">{msg.time}</span>
          </motion.div>
        ))}
      </div>

      <div className="bg-white p-6 rounded-b-[32px] border-x border-b border-mm-crd shadow-sm">
        <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
          {["Â¿CÃ³mo va mi pedido?", "Problema con entrega", "Cambiar direcciÃ³n", "Cancelar pedido"].map(chip => (
            <button
              key={chip}
              onClick={() => setInput(chip)}
              className="px-4 py-1.5 bg-mm-gbg text-mm-g text-xs font-bold rounded-full whitespace-nowrap hover:bg-mm-gll transition-colors"
            >
              {chip}
            </button>
          ))}
        </div>
        <form onSubmit={handleSend} className="flex gap-3">
          <button type="button" className="p-3 text-mm-txw hover:text-mm-g transition-colors"><Smile className="w-6 h-6" /></button>
          <button type="button" className="p-3 text-mm-txw hover:text-mm-g transition-colors"><Paperclip className="w-6 h-6" /></button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe un mensaje..."
            className="flex-grow bg-[#F0F2F5] rounded-full px-6 py-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-mm-gll transition-all"
          />
          <button
            type="submit"
            className="w-12 h-12 bg-mm-g text-white rounded-full flex items-center justify-center hover:bg-mm-gm transition-all shadow-md"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}


