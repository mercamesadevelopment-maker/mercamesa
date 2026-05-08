import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../store';
import { Order, Address, PaymentMethod, StoreReview } from '../types';
import { fmt } from '../constants';
import { Button, Badge, Input, cn } from './Shared';
import {
  ClipboardList, Package, Truck, CheckCircle2, XCircle,
  Clock, MapPin, CreditCard, Star, Heart, Settings,
  User, Bell, MessageSquare, Plus, Trash2, Edit2,
  ChevronRight, Send, Smile, Paperclip, MoreVertical,
  LayoutDashboard, Image as ImageIcon, Leaf, Flame, Trophy, Store, X
} from 'lucide-react';

export function OrdersView() {
  const { state, dispatch } = useApp();
  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'cancelled'>('active');
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [ratingStoreId, setRatingStoreId] = useState<number | null>(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState('');

  const handleOpenRating = (storeId: number) => {
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
        title: '¡Gracias por calificar!',
        msg: `Tu opinión sobre la tienda ha sido enviada con éxito.`,
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
                      <p className="text-xs text-mm-txw">Pedido #{order.id} • {new Date(order.date).toLocaleDateString()}</p>
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
                        <p className="text-xs text-mm-txw font-bold uppercase tracking-widest">Método de pago</p>
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
                {state.stores.find(s => s.id === ratingStoreId)?.emoji}
              </div>

              <h2 className="text-3xl font-fraunces text-mm-g mb-2">
                ¿Qué tal tu compra?
              </h2>
              <p className="text-mm-txs mb-8 font-medium">Califica a <span className="text-mm-g font-bold">{state.stores.find(s => s.id === ratingStoreId)?.name}</span></p>

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
                  placeholder="Cuéntanos más sobre los productos..."
                  className="w-full bg-mm-gbg/50 rounded-2xl p-6 text-sm outline-none border-1.5 border-transparent focus:border-mm-gll focus:bg-white transition-all min-h-[120px] resize-none"
                />
              </div>

              <div className="flex gap-4">
                <Button variant="outline" className="flex-1" onClick={() => setIsRatingModalOpen(false)}>
                  Cancelar
                </Button>
                <Button className="flex-1" onClick={handleSaveRating}>
                  Enviar Reseña
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function BuyerProfileView() {
  const { state, dispatch } = useApp();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingStoreId, setRatingStoreId] = useState<number | null>(null);
  const [ratingOrderId, setRatingOrderId] = useState<string | null>(null);

  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [addressForm, setAddressForm] = useState({
    label: '',
    street: '',
    neighborhood: '',
    notes: '',
    icon: '🏠',
    isDefault: false
  });
  const [paymentForm, setPaymentForm] = useState({
    label: '',
    type: 'card' as 'card' | 'cash',
    number: '',
    exp: '',
    isDefault: false
  });

  const profile = state.buyerProfile;

  React.useEffect(() => {
    if (state.currentSection === 'profile_ratings') {
      setActiveTab('ratings');
    }
  }, [state.currentSection]);

  const handleOpenAddPayment = () => {
    setPaymentForm({ label: '', type: 'card', number: '', exp: '', isDefault: false });
    setIsPaymentModalOpen(true);
  };

  const handleSavePayment = (e: React.FormEvent) => {
    e.preventDefault();
    let updatedPayments = [...profile.payments];
    const newPay: PaymentMethod = {
      id: String(Math.max(0, ...profile.payments.map(p => Number(p.id))) + 1),
      ...paymentForm
    };
    updatedPayments.push(newPay);

    if (paymentForm.isDefault) {
      updatedPayments = updatedPayments.map(p => ({
        ...p,
        isDefault: p.id === newPay.id
      }));
    }

    dispatch({
      type: 'UPDATE_BUYER_PROFILE',
      profile: { payments: updatedPayments }
    });
    setIsPaymentModalOpen(false);
  };

  const handleDeletePayment = (id: string) => {
    const updated = profile.payments.filter(p => p.id !== id);
    dispatch({
      type: 'UPDATE_BUYER_PROFILE',
      profile: { payments: updated }
    });
  };

  const handleOpenRating = (storeId: number, orderId: string) => {
    setRatingStoreId(storeId);
    setRatingOrderId(orderId);
    setRatingValue(5);
    setRatingComment('');
    setIsRatingModalOpen(true);
  };

  const handleSaveRating = () => {
    if (!ratingStoreId) return;

    const newRatings = { ...profile.storeRatings };
    newRatings[ratingStoreId] = {
      stars: ratingValue,
      comment: ratingComment,
      date: new Date().toISOString()
    };

    dispatch({
      type: 'UPDATE_BUYER_PROFILE',
      profile: { storeRatings: newRatings }
    });

    const newReview = {
      id: Math.random().toString(36).substr(2, 9),
      storeId: ratingStoreId,
      buyerId: state.isLoggedIn ? state.buyerProfile.email : 'guest', // Using email as ID for now
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
        title: '¡Gracias por tu calificación!',
        msg: `Tu opinión sobre ${state.stores.find(s => s.id === ratingStoreId)?.name} ha sido enviada.`,
        time: 'Ahora',
        read: false
      }
    });

    setIsRatingModalOpen(false);
  };

  const handleOpenAdd = () => {
    setEditingAddress(null);
    setAddressForm({ label: '', street: '', neighborhood: '', notes: '', icon: '🏠', isDefault: false });
    setIsAddressModalOpen(true);
  };

  const handleOpenEdit = (addr: Address) => {
    setEditingAddress(addr);
    setAddressForm({
      label: addr.label,
      street: addr.street,
      neighborhood: addr.neighborhood,
      notes: addr.notes || '',
      icon: addr.icon,
      isDefault: addr.isDefault
    });
    setIsAddressModalOpen(true);
  };

  const handleSaveAddress = (e: React.FormEvent) => {
    e.preventDefault();
    let updatedAddresses = [...profile.addresses];

    if (editingAddress) {
      updatedAddresses = updatedAddresses.map(a =>
        a.id === editingAddress.id ? { ...a, ...addressForm } : a
      );
    } else {
      const newAddr: Address = {
        id: String(Math.max(0, ...profile.addresses.map(a => Number(a.id))) + 1),
        ...addressForm,
        city: (addressForm as any).city ?? ''
      };
      updatedAddresses.push(newAddr);
    }

    // If setting as default, unset others
    if (addressForm.isDefault) {
      const lastId = editingAddress?.id || updatedAddresses[updatedAddresses.length - 1].id;
      updatedAddresses = updatedAddresses.map(a => ({
        ...a,
        isDefault: a.id === lastId
      }));
    }

    dispatch({
      type: 'UPDATE_BUYER_PROFILE',
      profile: { addresses: updatedAddresses }
    });
    setIsAddressModalOpen(false);
  };

  const handleDeleteAddress = (id: string) => {
    const updated = profile.addresses.filter(a => a.id !== id);
    dispatch({
      type: 'UPDATE_BUYER_PROFILE',
      profile: { addresses: updated }
    });
  };

  const tabs = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'addresses', icon: MapPin, label: 'Direcciones' },
    { id: 'payments', icon: CreditCard, label: 'Pagos' },
    { id: 'ratings', icon: Star, label: 'Calificar' },
    { id: 'favorites', icon: Heart, label: 'Favoritos' },
    { id: 'prefs', icon: Settings, label: 'Preferencias' },
    { id: 'account', icon: User, label: 'Mi cuenta' },
  ];

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Tabs */}
        <div className="w-full md:w-64 shrink-0 space-y-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl transition-all font-bold text-sm",
                activeTab === tab.id
                  ? "bg-mm-g text-white shadow-lg"
                  : "bg-white text-mm-txs border border-mm-crd hover:border-mm-g"
              )}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-grow">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="bg-white p-8 rounded-[40px] border border-mm-crd shadow-sm flex flex-col md:flex-row gap-8 items-center">
                  <div className="w-32 h-32 bg-mm-gll rounded-full flex items-center justify-center border-4 border-white shadow-xl overflow-hidden">
                    <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div className="flex-grow text-center md:text-left">
                    <h2 className="text-4xl font-fraunces text-mm-g mb-1">{profile.name}</h2>
                    <p className="text-mm-txs mb-4">Miembro desde {profile.memberSince}</p>
                    <div className="flex flex-wrap justify-center md:justify-start gap-3">
                      <Badge variant="oro" className="px-4 py-1.5 text-sm">⭐ {profile.rating} Calificación</Badge>
                      <Badge variant="info" className="px-4 py-1.5 text-sm">🪙 {profile.loyaltyPoints} PlazaCoins</Badge>
                    </div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="bg-white p-8 rounded-[32px] border border-mm-crd shadow-sm">
                    <h3 className="text-xl font-fraunces text-mm-g mb-6">Estadísticas</h3>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <p className="text-[10px] text-mm-txw font-bold uppercase tracking-widest mb-1">Pedidos</p>
                        <p className="text-3xl font-bold text-mm-g">{profile.totalOrders}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-mm-txw font-bold uppercase tracking-widest mb-1">Invertido</p>
                        <p className="text-3xl font-bold text-mm-g">{fmt(profile.totalSpent)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white p-8 rounded-[32px] border border-mm-crd shadow-sm">
                    <h3 className="text-xl font-fraunces text-mm-g mb-6">Logros</h3>
                    <div className="flex flex-wrap gap-3">
                      {[
                        { l: 'Primer pedido', icon: Leaf },
                        { l: 'Cliente frecuente', icon: Flame },
                        { l: 'Fan de la plaza', icon: MapPin },
                        { l: 'Gourmet', icon: Trophy }
                      ].map(logro => (
                        <div key={logro.l} className="w-12 h-12 bg-mm-gbg rounded-full flex items-center justify-center shadow-sm border border-white text-mm-g" title={logro.l}>
                          <logro.icon className="w-6 h-6" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'addresses' && (
              <motion.div
                key="addresses"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-3xl font-fraunces text-mm-g">Mis Direcciones</h2>
                  <Button size="sm" onClick={handleOpenAdd}><Plus className="w-4 h-4" /> Agregar</Button>
                </div>
                <div className="grid gap-4">
                  {profile.addresses.map(addr => (
                    <div key={addr.id} className="bg-white p-6 rounded-3xl border border-mm-crd shadow-sm flex items-center gap-6">
                      <div className="w-14 h-14 bg-mm-gbg rounded-2xl flex items-center justify-center text-3xl shrink-0 overflow-hidden text-mm-g">
                        <MapPin className="w-7 h-7" />
                      </div>
                      <div className="flex-grow">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-mm-g">{addr.label}</h4>
                          {addr.isDefault && <Badge variant="success" className="text-[10px]">Predeterminada</Badge>}
                        </div>
                        <p className="text-sm text-mm-txs">{addr.street}, {addr.neighborhood}</p>
                        <p className="text-xs text-mm-txw">{addr.notes}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="p-2 hover:bg-mm-gbg rounded-full text-mm-txw hover:text-mm-g transition-colors"
                          onClick={() => handleOpenEdit(addr)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          className="p-2 hover:bg-mm-gbg rounded-full text-mm-txw hover:text-r transition-colors"
                          onClick={() => handleDeleteAddress(addr.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {profile.addresses.length === 0 && (
                    <div className="text-center py-12 bg-white rounded-3xl border border-mm-crd border-dashed">
                      <p className="text-mm-txw">No tienes direcciones guardadas.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'payments' && (
              <motion.div
                key="payments"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-3xl font-fraunces text-mm-g">Medios de Pago</h2>
                  <Button size="sm" onClick={handleOpenAddPayment}><Plus className="w-4 h-4" /> Agregar</Button>
                </div>
                <div className="grid gap-4">
                  {profile.payments.map(pay => (
                    <div key={pay.id} className="bg-white p-6 rounded-3xl border border-mm-crd shadow-sm flex items-center gap-6">
                      <div className="w-14 h-14 bg-mm-gbg rounded-2xl flex items-center justify-center text-3xl shrink-0 text-mm-g">
                        {pay.type === 'card' ? <CreditCard className="w-7 h-7" /> : <Package className="w-7 h-7" />}
                      </div>
                      <div className="flex-grow">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-mm-g">{pay.label}</h4>
                          {pay.isDefault && <Badge variant="success" className="text-[10px]">Predeterminado</Badge>}
                        </div>
                        {pay.type === 'card' ? <p className="text-sm text-mm-txs">Vence: {pay.exp}</p> : <p className="text-sm text-mm-txs">Pago contra entrega</p>}
                      </div>
                      <button
                        className="p-2 hover:bg-mm-gbg rounded-full text-mm-txw hover:text-r transition-colors"
                        onClick={() => handleDeletePayment(pay.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {profile.payments.length === 0 && (
                    <div className="text-center py-12 bg-white rounded-3xl border border-mm-crd border-dashed">
                      <p className="text-mm-txw">No tienes medios de pago guardados.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'ratings' && (
              <motion.div
                key="ratings"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-8"
              >
                <div>
                  <h2 className="text-3xl font-fraunces text-mm-g mb-2">Calificaciones</h2>
                  <p className="text-mm-txs">Tu opinión ayuda a mejorar la comunidad de Mercamesa.</p>
                </div>

                {/* Pendientes de calificar */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-mm-txw uppercase tracking-widest flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Pendientes
                  </h3>
                  <div className="grid gap-4">
                    {state.orders
                      .filter(o => o.status === 'delivered' && !profile.storeRatings[o.storeId])
                      .map(order => (
                        <div key={order.id} className="bg-white p-6 rounded-[32px] border border-mm-crd shadow-sm flex items-center gap-6">
                          <div className="w-16 h-16 bg-mm-gbg rounded-2xl flex items-center justify-center overflow-hidden border border-mm-crd shadow-inner">
                            <img src={"https://picsum.photos/seed/store/100/100"} alt={order.storeName} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-grow">
                            <h4 className="font-bold text-mm-g text-lg">{order.storeName}</h4>
                            <p className="text-xs text-mm-txw">Pedido #{order.id} • {new Date(order.date).toLocaleDateString()}</p>
                          </div>
                          <Button size="sm" onClick={() => handleOpenRating(order.storeId, order.id)}>Calificar</Button>
                        </div>
                      ))}
                    {state.orders.filter(o => o.status === 'delivered' && !profile.storeRatings[o.storeId]).length === 0 && (
                      <div className="p-10 text-center bg-mm-gbg/20 rounded-[32px] border border-dashed border-mm-crd opacity-60">
                        <p className="text-mm-txs">¡Estás al día! No tienes calificaciones pendientes.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Calificaciones realizadas */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-mm-txw uppercase tracking-widest flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Mis Opiniones
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {Object.entries(profile.storeRatings).map(([storeId, rating]: [string, any]) => {
                      const store = state.stores.find(s => s.id === parseInt(storeId));
                      if (!store) return null;
                      return (
                        <div key={storeId} className="bg-white p-6 rounded-[32px] border border-mm-crd shadow-sm">
                          <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 bg-mm-gbg rounded-xl flex items-center justify-center text-2xl">
                              {store.emoji}
                            </div>
                            <div className="flex-grow">
                              <h4 className="font-bold text-mm-g">{store.name}</h4>
                              <div className="flex text-mm-oro">
                                {[...Array(5)].map((_, i) => (
                                  <Star key={i} className={cn("w-3.5 h-3.5", i < rating.stars ? "fill-mm-oro" : "text-mm-crd")} />
                                ))}
                              </div>
                            </div>
                            <span className="text-[10px] text-mm-txw font-medium bg-mm-gbg px-2 py-1 rounded-lg">
                              {new Date(rating.date).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm text-mm-txs italic">"{rating.comment || 'Sin comentarios'}"</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'favorites' && (
              <motion.div
                key="favorites"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <h2 className="text-3xl font-fraunces text-mm-g">Tiendas Favoritas</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {profile.favoriteStores.map(storeId => {
                    const store = state.stores.find(s => s.id === storeId);
                    if (!store) return null;
                    return (
                      <div
                        key={storeId}
                        className="bg-white p-5 rounded-3xl border border-mm-crd shadow-sm flex items-center gap-4 group cursor-pointer hover:border-mm-g transition-all"
                        onClick={() => {
                          dispatch({
                            type: 'SELECT_STORE',
                            plazaId: store.plazaId,
                            storeId: store.id
                          });
                        }}
                      >
                        <div className="w-14 h-14 bg-mm-gbg rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform overflow-hidden border border-mm-crd shadow-inner">
                          {store.image ? (
                            <img src={store.image} alt={store.name} className="w-full h-full object-cover" />
                          ) : (
                            <Store className="w-6 h-6 text-mm-txw" />
                          )}
                        </div>
                        <div className="flex-grow">
                          <h4 className="font-bold text-mm-g">{store.name}</h4>
                          <p className="text-xs text-mm-txw">{store.cat}</p>
                        </div>
                        <button
                          className="p-2 text-r hover:bg-rl rounded-full transition-all relative z-10"
                          onClick={(e) => {
                            e.stopPropagation();
                            const updated = profile.favoriteStores.filter(id => id !== storeId);
                            dispatch({ type: 'UPDATE_BUYER_PROFILE', profile: { favoriteStores: updated } });
                          }}
                        >
                          <Heart className="w-5 h-5 fill-r" />
                        </button>
                      </div>
                    );
                  })}
                  {profile.favoriteStores.length === 0 && (
                    <div className="sm:col-span-2 text-center py-12 bg-white rounded-3xl border border-mm-crd border-dashed">
                      <p className="text-mm-txw">Aún no tienes tiendas favoritas.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'prefs' && (
              <motion.div
                key="prefs"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white p-8 rounded-[40px] border border-mm-crd shadow-sm"
              >
                <h2 className="text-3xl font-fraunces text-mm-g mb-8">Notificaciones</h2>
                <div className="space-y-6 max-w-xl">
                  {[
                    { id: 'orderNotif', label: 'Estado de pedidos', sub: 'Recibir avisos cuando tu pedido cambie de estado.' },
                    { id: 'promoNotif', label: 'Promociones y ofertas', sub: 'Enterarte de descuentos exclusivos en tus plazas favoritas.' },
                    { id: 'stockNotif', label: 'Disponibilidad de stock', sub: 'Aviso cuando vuelvan productos de tus favoritos.' },
                    { id: 'whatsappNotif', label: 'Alertas por WhatsApp', sub: 'Recibir resumen de tus pedidos directamente en tu móvil.' }
                  ].map(p => (
                    <div key={p.id} className="flex items-center justify-between gap-6 p-4 rounded-3xl hover:bg-mm-gbg/50 transition-colors">
                      <div>
                        <p className="font-bold text-mm-g">{p.label}</p>
                        <p className="text-xs text-mm-txw">{p.sub}</p>
                      </div>
                      <button
                        onClick={() => {
                          const newPrefs = { ...profile.prefs, [p.id]: !profile.prefs[p.id as keyof typeof profile.prefs] };
                          dispatch({ type: 'UPDATE_BUYER_PROFILE', profile: { prefs: newPrefs } });
                        }}
                        className={cn(
                          "w-12 h-6 rounded-full relative transition-all duration-300",
                          profile.prefs[p.id as keyof typeof profile.prefs] ? "bg-mm-g" : "bg-mm-crd"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300",
                          profile.prefs[p.id as keyof typeof profile.prefs] ? "left-7" : "left-1"
                        )} />
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'account' && (
              <motion.div
                key="account"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white p-8 rounded-[40px] border border-mm-crd shadow-sm"
              >
                <h2 className="text-3xl font-fraunces text-mm-g mb-8">Mi Cuenta</h2>
                <form className="space-y-6 max-w-xl">
                  <div className="flex items-center gap-6 mb-8">
                    <div className="w-24 h-24 bg-mm-gll rounded-full flex items-center justify-center text-5xl border-4 border-white shadow-lg">
                      {profile.avatar}
                    </div>
                    <Button variant="outline" size="sm">Cambiar avatar</Button>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Input label="Nombre" defaultValue={profile.name} />
                    <Input label="Teléfono" defaultValue={profile.phone} />
                    <Input label="Email" defaultValue={profile.email} className="sm:col-span-2" />
                  </div>
                  <Button className="w-full sm:w-auto px-12">Guardar cambios</Button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Address Modal */}
      <AnimatePresence>
        {isAddressModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddressModalOpen(false)}
              className="absolute inset-0 bg-mm-g/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-[40px] shadow-2xl overflow-hidden max-w-lg w-full p-10"
            >
              <button
                onClick={() => setIsAddressModalOpen(false)}
                className="absolute top-6 right-6 p-2 hover:bg-mm-gbg rounded-full transition-colors z-10"
              >
                <XCircle className="w-6 h-6 text-mm-txs" />
              </button>

              <h2 className="text-3xl font-fraunces text-mm-g mb-6">
                {editingAddress ? 'Editar Dirección' : 'Nueva Dirección'}
              </h2>

              <form onSubmit={handleSaveAddress} className="space-y-4">
                <div className="flex gap-4">
                  <div className="w-20 h-20 bg-mm-gbg rounded-3xl flex items-center justify-center text-4xl shrink-0">
                    {addressForm.icon}
                  </div>
                  <Input
                    label="Emoji"
                    value={addressForm.icon}
                    onChange={e => setAddressForm({ ...addressForm, icon: e.target.value })}
                    placeholder="🏠"
                  />
                </div>

                <Input
                  label="Nombre / Etiqueta"
                  value={addressForm.label}
                  onChange={e => setAddressForm({ ...addressForm, label: e.target.value })}
                  placeholder="Ej: Casa, Trabajo, Novia"
                  required
                />

                <Input
                  label="Dirección (Calle/Carrera)"
                  value={addressForm.street}
                  onChange={e => setAddressForm({ ...addressForm, street: e.target.value })}
                  placeholder="Ej: Calle 45 # 23-12"
                  required
                />

                <Input
                  label="Barrio / Sector"
                  value={addressForm.neighborhood}
                  onChange={e => setAddressForm({ ...addressForm, neighborhood: e.target.value })}
                  placeholder="Ej: Laureles"
                  required
                />

                <Input
                  label="Notas adicionales"
                  value={addressForm.notes}
                  onChange={e => setAddressForm({ ...addressForm, notes: e.target.value })}
                  placeholder="Ej: Apto 302, Portería vigilada"
                />

                <div className="flex items-center gap-3 p-4 bg-mm-gbg/10 rounded-2xl border border-mm-crd">
                  <input
                    type="checkbox"
                    id="isDefault"
                    checked={addressForm.isDefault}
                    onChange={e => setAddressForm({ ...addressForm, isDefault: e.target.checked })}
                    className="w-5 h-5 rounded border-mm-crd text-mm-g focus:ring-mm-g"
                  />
                  <label htmlFor="isDefault" className="text-sm font-bold text-mm-g cursor-pointer">
                    Establecer como dirección predeterminada
                  </label>
                </div>

                <div className="pt-4 flex gap-3">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setIsAddressModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1">
                    {editingAddress ? 'Guardar Cambios' : 'Agregar Dirección'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rating Modal */}
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
                <XCircle className="w-6 h-6 text-mm-txs" />
              </button>

              <div className="w-24 h-24 bg-mm-gbg rounded-3xl flex items-center justify-center text-5xl mx-auto mb-6 shadow-sm border border-mm-crd/50">
                {state.stores.find(s => s.id === ratingStoreId)?.emoji}
              </div>

              <h2 className="text-3xl font-fraunces text-mm-g mb-2">
                ¿Qué tal tu experiencia?
              </h2>
              <p className="text-mm-txs mb-8 font-medium">Califica a <span className="text-mm-g font-bold">{state.stores.find(s => s.id === ratingStoreId)?.name}</span></p>

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
                  placeholder="Cuéntanos más... ¿Los productos estaban frescos? ¿Llegaron a tiempo?"
                  className="w-full bg-mm-gbg/50 rounded-2xl p-6 text-sm outline-none border-1.5 border-transparent focus:border-mm-gll focus:bg-white transition-all min-h-[120px] resize-none"
                />

                <div className="flex flex-wrap justify-center gap-2">
                  {["Productos frescos", "Gran servicio", "Precio justo", "Rápido"].map(chip => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setRatingComment(prev => prev ? `${prev}, ${chip}` : chip)}
                      className="px-4 py-1.5 bg-mm-gbg text-mm-txs text-xs font-bold rounded-full hover:bg-mm-gll transition-colors"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-4">
                <Button variant="outline" className="flex-1" onClick={() => setIsRatingModalOpen(false)}>
                  Omitir
                </Button>
                <Button className="flex-1" onClick={handleSaveRating}>
                  Enviar Opinión
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Payment Modal */}
      <AnimatePresence>
        {isPaymentModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPaymentModalOpen(false)}
              className="absolute inset-0 bg-mm-g/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-[40px] shadow-2xl overflow-hidden max-w-lg w-full p-10"
            >
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="absolute top-6 right-6 p-2 hover:bg-mm-gbg rounded-full transition-colors z-10"
              >
                <XCircle className="w-6 h-6 text-mm-txs" />
              </button>

              <h2 className="text-3xl font-fraunces text-mm-g mb-6">Nuevo Medio de Pago</h2>

              <form onSubmit={handleSavePayment} className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-mm-txs ml-1">Tipo de Pago</label>
                  <select
                    value={paymentForm.type}
                    onChange={e => setPaymentForm({ ...paymentForm, type: e.target.value as any })}
                    className="px-4 py-2.5 rounded-xl border-1.5 border-mm-crd bg-white focus:border-mm-g outline-none transition-all text-sm"
                  >
                    <option value="card">Tarjeta de Crédito / Débito</option>
                    <option value="cash">Efectivo (Contra entrega)</option>
                  </select>
                </div>

                <Input
                  label="Nombre / Etiqueta"
                  value={paymentForm.label}
                  onChange={e => setPaymentForm({ ...paymentForm, label: e.target.value })}
                  placeholder="Ej: Mi Visa, Personal, Efectivo"
                  required
                />

                {paymentForm.type === 'card' && (
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Número (últimos 4)"
                      value={paymentForm.number}
                      onChange={e => setPaymentForm({ ...paymentForm, number: e.target.value })}
                      placeholder="Ej: 4422"
                      maxLength={4}
                      required
                    />
                    <Input
                      label="Vencimiento"
                      value={paymentForm.exp}
                      onChange={e => setPaymentForm({ ...paymentForm, exp: e.target.value })}
                      placeholder="Ej: 05/28"
                      required
                    />
                  </div>
                )}

                <div className="flex items-center gap-3 p-4 bg-mm-gbg/10 rounded-2xl border border-mm-crd">
                  <input
                    type="checkbox"
                    id="isPayDefault"
                    checked={paymentForm.isDefault}
                    onChange={e => setPaymentForm({ ...paymentForm, isDefault: e.target.checked })}
                    className="w-5 h-5 rounded border-mm-crd text-mm-g focus:ring-mm-g"
                  />
                  <label htmlFor="isPayDefault" className="text-sm font-bold text-mm-g cursor-pointer">
                    Establecer como medio predeterminado
                  </label>
                </div>

                <div className="pt-4 flex gap-3">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setIsPaymentModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1">
                    Agregar Medio de Pago
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SupportChatView() {
  const [messages, setMessages] = useState([
    { id: 1, text: "¡Hola! Bienvenido al soporte de Mercamesa. 🌿", sender: 'bot', time: '10:00 AM' },
    { id: 2, text: "¿En qué podemos ayudarte hoy?", sender: 'bot', time: '10:00 AM' },
  ]);
  const [input, setInput] = useState('');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = { id: Date.now(), text: input, sender: 'user', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setMessages([...messages, userMsg]);
    setInput('');

    setTimeout(() => {
      const botMsg = { id: Date.now() + 1, text: "Estamos revisando tu solicitud. Un agente se conectará pronto.", sender: 'bot', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
      setMessages(prev => [...prev, botMsg]);
    }, 1000);
  };

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto h-[calc(100vh-120px)] flex flex-col">
      <div className="bg-white p-6 rounded-t-[32px] border-x border-t border-mm-crd shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-mm-g rounded-full flex items-center justify-center text-2xl">🌿</div>
          <div>
            <h2 className="font-bold text-mm-g">Soporte Mercamesa</h2>
            <p className="text-xs text-ok font-bold flex items-center gap-1">
              <span className="w-2 h-2 bg-ok rounded-full animate-pulse" /> En línea ahora
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
          {["¿Cómo va mi pedido?", "Problema con entrega", "Cambiar dirección", "Cancelar pedido"].map(chip => (
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


