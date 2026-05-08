import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../store';
import { Plaza, Store, Product, Offer } from '../types';
import { fmt, CAT_DATA } from '../constants';
import { Button, Badge, cn } from './Shared';
import { 
  Star, MapPin, Store as StoreIcon, 
  ChevronRight, ArrowLeft, Filter, Search,
  ShoppingCart, Info, CheckCircle2, Clock, Phone, X, MessageSquare,
  Image as ImageIcon, Tag, Zap, Flame, Trophy, Calendar, 
  Layers, Heart, Mail, Compass, Globe
} from 'lucide-react';

export function MarketView() {
  const { state, dispatch } = useApp();
  const router = useRouter();
  const [selectedPlaza, setSelectedPlaza] = useState<Plaza | null>(null);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCat, setActiveCat] = useState('Todos');
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [storeTab, setStoreTab] = useState<'products' | 'reviews'>('products');
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [modalQty, setModalQty] = useState(1);
  const [modalUnitMode, setModalUnitMode] = useState<'base' | 'alt'>('base');

  React.useEffect(() => {
    setModalQty(1);
    setModalUnitMode('base');
  }, [selectedProduct]);

  const selectedOfferProducts = useMemo(() => {
    if (!selectedOffer) return [];
    return state.products.filter(p => selectedOffer.productIds.includes(p.id));
  }, [selectedOffer, state.products]);

  React.useEffect(() => {
    if (state.selectedPlazaId) {
      const plaza = state.plazas.find(p => p.id === state.selectedPlazaId);
      if (plaza) setSelectedPlaza(plaza);
    } else {
      setSelectedPlaza(null);
    }
    
    if (state.selectedStoreId) {
      const store = state.stores.find(s => s.id === state.selectedStoreId);
      if (store) setSelectedStore(store);
    } else {
      setSelectedStore(null);
    }
  }, [state.selectedPlazaId, state.selectedStoreId, state.plazas, state.stores]);

  const getProductPrice = (product: Product) => {
    const basePrice = state.userRole === 'wholesale' ? product.wsPrice : product.retailPrice;
    const offer = state.offers.find(o => o.status === 'active' && o.productIds.includes(product.id));
    
    if (!offer) return { price: basePrice, original: null };
    
    let discounted = basePrice;
    if (offer.type === 'percentage') {
      discounted = basePrice * (1 - offer.value / 100);
    } else {
      discounted = Math.max(0, basePrice - offer.value);
    }
    
    return { price: Math.floor(discounted), original: basePrice };
  };

  const categories = ['Todos', 'Verduras', 'Frutas', 'Especias', 'Granos', 'Carnes', 'Lácteos'];

  const filteredPlazas = useMemo(() => {
    return state.plazas.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.city.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [state.plazas, searchQuery]);

  const filteredStores = useMemo(() => {
    if (!selectedPlaza) return [];
    return state.stores.filter(s => 
      s.plazaId === selectedPlaza.id && 
      (activeCat === 'Todos' || s.cat.includes(activeCat)) &&
      (s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [state.stores, selectedPlaza, activeCat, searchQuery]);

  const filteredProducts = useMemo(() => {
    if (!selectedStore) return [];
    return state.products.filter(p => 
      p.storeId === selectedStore.id && 
      (activeCat === 'Todos' || p.cat === activeCat) &&
      (p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [state.products, selectedStore, activeCat, searchQuery]);

  const plazaOffers = useMemo(() => {
    if (!selectedPlaza) return [];
    return state.offers.filter(o => o.plazaId === selectedPlaza.id && o.status === 'active');
  }, [state.offers, selectedPlaza]);

  const toggleFavorite = (e: React.MouseEvent, storeId: number) => {
    e.stopPropagation();
    const isFav = state.buyerProfile.favoriteStores.includes(storeId);
    let updated;
    if (isFav) {
      updated = state.buyerProfile.favoriteStores.filter(id => id !== storeId);
    } else {
      updated = [...state.buyerProfile.favoriteStores, storeId];
    }
    dispatch({ type: 'UPDATE_BUYER_PROFILE', profile: { favoriteStores: updated } });
    
    if (!isFav) {
      dispatch({
        type: 'ADD_NOTIF',
        notif: {
          id: Math.random().toString(36).substr(2, 9),
          type: 'rating',
          title: 'Tienda favorita',
          msg: `Has añadido a la tienda a tus favoritos.`,
          time: 'Ahora',
          read: false
        }
      });
    }
  };

  const handleBackToPlazas = () => {
    setSelectedPlaza(null);
    setSelectedStore(null);
    setSearchQuery('');
    setActiveCat('Todos');
    dispatch({ type: 'CLEAR_STORE_SELECTION' });
  };

  const handleBackToStores = () => {
    setSelectedStore(null);
    setSearchQuery('');
    setActiveCat('Todos');
    setStoreTab('products');
    dispatch({ type: 'CLEAR_STORE_SELECTION' });
  };

  const storeReviews = useMemo(() => {
    if (!selectedStore) return [];
    return state.reviews.filter(r => r.storeId === selectedStore.id);
  }, [state.reviews, selectedStore]);

  const hasPurchased = useMemo(() => {
    if (!selectedStore) return false;
    return state.orders.some(o => o.storeId === selectedStore.id && o.status === 'delivered');
  }, [state.orders, selectedStore]);

  const alreadyRated = useMemo(() => {
    if (!selectedStore) return false;
    return state.reviews.some(r => r.storeId === selectedStore.id && r.buyerId === state.buyerProfile.email);
  }, [state.reviews, selectedStore, state.buyerProfile.email]);

  const handleSaveReview = () => {
    if (!selectedStore) return;
    
    // Update profile
    const newRatings = { ...state.buyerProfile.storeRatings };
    newRatings[selectedStore.id] = {
      stars: ratingValue,
      comment: ratingComment,
      date: new Date().toISOString()
    };

    dispatch({
      type: 'UPDATE_BUYER_PROFILE',
      profile: { storeRatings: newRatings }
    });

    const review = {
      id: Math.random().toString(36).substr(2, 9),
      storeId: selectedStore.id,
      buyerId: state.buyerProfile.email,
      buyerName: state.buyerProfile.name,
      stars: ratingValue,
      comment: ratingComment,
      date: new Date().toISOString()
    };
    dispatch({ type: 'ADD_REVIEW', review });

    dispatch({
      type: 'ADD_NOTIF',
      notif: {
        id: Math.random().toString(36).substr(2, 9),
        type: 'rating',
        title: '¡Gracias por tu calificación!',
        msg: `Tu opinión sobre ${selectedStore.name} ha sido enviada con éxito.`,
        time: 'Ahora',
        read: false
      }
    });

    setIsRatingModalOpen(false);
    setRatingComment('');
  };

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <AnimatePresence mode="wait">
        {!selectedPlaza ? (
          <motion.div 
            key="plazas"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
              <div>                <h1 className="text-4xl font-fraunces text-mm-g mb-2">Explora las Plazas</h1>
                <p className="text-mm-txs">Encuentra los mejores productos frescos directamente de la fuente.</p>
              </div>
              <div className="relative w-full max-w-md mx-auto">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-mm-txw" />
                <input 
                  type="text" 
                  placeholder="Buscar plaza o ciudad..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-mm-crd rounded-full py-2.5 pl-11 pr-4 text-sm outline-none focus:border-mm-g transition-all"
                />
              </div>
            </div>

            {state.offers.length > 0 && (
              <div className="mb-12">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-fraunces text-mm-g leading-tight">Ofertas del Día 🔥</h2>
                    <p className="text-sm text-mm-txs">Ahorra con estos descuentos exclusivos de nuestras tiendas.</p>
                  </div>
                  <Button variant="ghost" className="text-mm-g font-bold">Ver todas <ChevronRight className="w-4 h-4" /></Button>
                </div>
                <div className="flex gap-6 overflow-x-auto pb-6 scrollbar-hide -mx-2 px-2">
                  {state.offers.map(offer => {
                    const store = state.stores.find(s => s.id === offer.storeId);
                    return (
                      <motion.div 
                        key={offer.id} 
                        whileHover={{ y: -5 }}
                        className="min-w-[300px] md:min-w-[380px] bg-white rounded-[32px] border border-mm-crd shadow-sm overflow-hidden flex h-40 group cursor-pointer"
                        onClick={() => {
                          setSelectedOffer(offer);
                        }}
                      >
                        <div className="w-1/3 bg-mm-gbg flex items-center justify-center text-4xl group-hover:scale-110 transition-transform overflow-hidden">
                          {offer.image ? (
                            <img src={offer.image} alt={offer.title} className="w-full h-full object-cover" />
                          ) : (
                            offer.emoji
                          )}
                        </div>
                        <div className="p-5 w-2/3 flex flex-col justify-between">
                          <div>
                            <Badge variant="oro" className="mb-2 text-[10px] uppercase font-bold tracking-widest">{store?.name}</Badge>
                            <h3 className="font-bold text-mm-g leading-tight mb-1 group-hover:text-mm-oro transition-colors">{offer.title}</h3>
                            <p className="text-[11px] text-mm-txs line-clamp-2 leading-relaxed">{offer.desc}</p>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <span className="bg-rl text-r px-3 py-1 rounded-full font-bold text-sm">
                              {offer.type === 'percentage' ? `${offer.value}% OFF` : `-$${offer.value.toLocaleString()}`}
                            </span>
                            <div className="w-8 h-8 rounded-full bg-mm-g/10 flex items-center justify-center text-mm-g">
                                <ChevronRight className="w-4 h-4" />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Retail Exclusive Sections */}
            {state.userRole === 'retail' && (
              <>
                {/* Most Purchased Section */}
                <div className="mb-12">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-2xl font-fraunces text-mm-g leading-tight flex items-center gap-2">
                        Los más buscados de la semana <Flame className="w-6 h-6 text-mm-oro animate-pulse" />
                      </h2>
                      <p className="text-sm text-mm-txs">Lo que tu comunidad está llevando hoy.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                     {state.products.slice(0, 4).map(p => (
                       <motion.div 
                        key={p.id}
                        whileHover={{ y: -5 }}
                        className="bg-white p-4 rounded-3xl border border-mm-crd shadow-sm group cursor-pointer"
                        onClick={() => {
                          const store = state.stores.find(s => s.id === p.storeId);
                          if (store) {
                            const plaza = state.plazas.find(p => p.id === store.plazaId);
                            if (plaza) setSelectedPlaza(plaza);
                            setSelectedStore(store);
                          }
                        }}
                       >
                         <div className="h-32 bg-mm-gbg rounded-2xl flex items-center justify-center text-5xl mb-4 group-hover:scale-105 transition-transform overflow-hidden">
                           {p.image ? (
                             <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                           ) : p.emoji}
                         </div>
                         <h4 className="font-bold text-mm-g mb-1 line-clamp-1">{p.name}</h4>
                         <div className="flex items-center justify-between">
                            <span className="text-mm-oro font-bold">{fmt(p.retailPrice)}</span>
                            <Badge variant="default" className="text-[10px]">+{Math.floor(Math.random() * 100) + 50} vendidos</Badge>
                         </div>
                       </motion.div>
                     ))}
                  </div>
                </div>

                {/* Top Rated Stores */}
                <div className="mb-12">
                   <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-2xl font-fraunces text-mm-g leading-tight flex items-center gap-2">
                        Tiendas mejor calificadas <Trophy className="w-6 h-6 text-mm-oro" />
                      </h2>
                      <p className="text-sm text-mm-txs">Confianza y calidad garantizada por los compradores.</p>
                    </div>
                  </div>
                  <div className="flex gap-6 overflow-x-auto pb-6 scrollbar-hide -mx-2 px-2">
                    {[...state.stores].sort((a,b) => b.rating - a.rating).slice(0, 4).map(store => (
                      <motion.div
                        key={store.id}
                        whileHover={{ x: 5 }}
                        className="min-w-[280px] bg-white p-5 rounded-[32px] border border-mm-crd shadow-sm flex items-center gap-4 cursor-pointer hover:border-mm-oro transition-colors"
                        onClick={() => {
                          const plaza = state.plazas.find(p => p.id === store.plazaId);
                          if (plaza) setSelectedPlaza(plaza);
                          setSelectedStore(store);
                        }}
                      >
                         <div className="w-16 h-16 bg-mm-gbg rounded-2xl flex items-center justify-center text-3xl shrink-0 overflow-hidden relative group">
                           {store.image ? (
                             <img src={store.image} alt={store.name} className="w-full h-full object-cover" />
                           ) : store.emoji}
                           <button 
                            onClick={(e) => toggleFavorite(e, store.id)}
                            className={cn(
                              "absolute top-1 right-1 p-1.5 rounded-full bg-white/80 backdrop-blur-sm shadow-sm transition-all transform scale-0 group-hover:scale-100",
                              state.buyerProfile.favoriteStores.includes(store.id) ? "text-r opacity-100 scale-100" : "text-mm-txw hover:text-r"
                            )}
                           >
                             <Heart className={cn("w-3.5 h-3.5", state.buyerProfile.favoriteStores.includes(store.id) && "fill-r")} />
                           </button>
                         </div>
                         <div className="overflow-hidden">
                           <h4 className="font-bold text-mm-g truncate leading-none mb-1">{store.name}</h4>
                           <div className="flex items-center gap-1 text-mm-oro font-bold text-xs mb-1">
                             <Star className="w-3.5 h-3.5 fill-mm-oro" /> {store.rating}
                           </div>
                           <p className="text-[10px] text-mm-txw uppercase tracking-widest truncate">{store.cat}</p>
                         </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Catalog Categories */}
                <div className="mb-12">
                   <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-2xl font-fraunces text-mm-g leading-tight flex items-center gap-2">
                        Categorías del Catálogo <Layers className="w-6 h-6 text-mm-g" />
                      </h2>
                      <p className="text-sm text-mm-txs">Explora por tipos de productos.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                     {CAT_DATA.map(cat => (
                       <button
                         key={cat.name}
                          onClick={() => {
                            setActiveCat(cat.name);
                            router.push('/all-products');
                          }}
                         className="flex flex-col items-center gap-3 p-4 rounded-3xl bg-white border border-mm-crd hover:border-mm-g hover:bg-mm-gbg transition-all group"
                       >
                         <div className="w-12 h-12 rounded-2xl bg-mm-gbg group-hover:bg-white flex items-center justify-center text-2xl transition-colors overflow-hidden border border-mm-crd/50">
                            <img src={cat.image} alt={cat.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                         </div>
                         <span className="text-xs font-bold text-mm-txs group-hover:text-mm-g">{cat.name}</span>
                       </button>
                     ))}
                  </div>
                </div>

                {/* Seasonal Products */}
                <div className="mb-12 bg-mm-oro/5 p-8 rounded-[40px] border border-mm-oro/10 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-mm-oro/10 rounded-full blur-3xl -mr-32 -mt-32" />
                  <div className="flex items-center justify-between mb-8 relative z-10">
                    <div>
                      <h2 className="text-2xl font-fraunces text-mm-g leading-tight flex items-center gap-2">
                        Productos de Temporada <Calendar className="w-6 h-6 text-mm-oro" />
                      </h2>
                      <p className="text-sm text-mm-txs">Aprovecha la cosecha actual con los mejores precios.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                     {state.products.slice(4, 7).map(p => (
                       <div 
                        key={p.id}
                        className="bg-white p-6 rounded-[32px] shadow-sm border border-mm-oro/20 flex gap-4 hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => {
                           const store = state.stores.find(s => s.id === p.storeId);
                           if (store) {
                             const plaza = state.plazas.find(p => p.id === store.plazaId);
                             if (plaza) setSelectedPlaza(plaza);
                             setSelectedStore(store);
                           }
                         }}
                       >
                         <div className="w-20 h-20 bg-mm-gbg rounded-2xl flex items-center justify-center text-4xl shrink-0 overflow-hidden">
                           {p.image ? (
                             <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                           ) : p.emoji}
                         </div>
                         <div>
                            <Badge variant="oro" className="mb-1">Cosecha Local</Badge>
                            <h4 className="font-bold text-mm-g text-lg">{p.name}</h4>
                            <p className="text-xs text-mm-txs mb-2 line-clamp-2">{p.desc}</p>
                            <span className="text-mm-g font-bold">{fmt(p.retailPrice)} / {p.unit}</span>
                         </div>
                       </div>
                     ))}
                  </div>
                </div>
              </>
            )}

            <div className="flex items-center justify-between mb-6">
               <h2 className="text-2xl font-fraunces text-mm-g">Explore las Plazas Cercanas</h2>
               <p className="text-xs text-mm-txw">Mostrando {filteredPlazas.length} resultados</p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredPlazas.map(plaza => (
                <motion.div
                  key={plaza.id}
                  whileHover={{ y: -8 }}
                  onClick={() => setSelectedPlaza(plaza)}
                  className="bg-white rounded-3xl border border-mm-crd shadow-sm hover:shadow-xl transition-all cursor-pointer overflow-hidden group"
                >
                  <div className="h-40 flex items-center justify-center text-6xl group-hover:scale-105 transition-transform overflow-hidden relative" style={{ backgroundColor: plaza.bg }}>
                    {plaza.image ? (
                      <img src={plaza.image} alt={plaza.name} className="w-full h-full object-cover" />
                    ) : (
                      plaza.emoji
                    )}
                  </div>
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-xl font-bold text-mm-g font-fraunces">{plaza.name}</h3>
                      <div className="flex items-center gap-1 text-mm-oro font-bold text-sm">
                        <Star className="w-4 h-4 fill-mm-oro" /> {plaza.rating}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-mm-txw mb-4">
                      <MapPin className="w-3.5 h-3.5" /> {plaza.city} • {plaza.address}
                    </div>
                    <div className="flex flex-wrap gap-2 mb-6">
                      {plaza.tags.map(tag => (
                        <React.Fragment key={tag}>
                          <Badge className="text-[10px]">{tag}</Badge>
                        </React.Fragment>
                      ))}
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-mm-crd">
                      <div className="flex items-center gap-2 text-xs font-bold text-mm-txs">
                        <StoreIcon className="w-4 h-4" /> {plaza.stores} tiendas
                      </div>
                      <Badge variant={plaza.open ? 'success' : 'error'}>
                        {plaza.open ? 'Abierta' : 'Cerrada'}
                      </Badge>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ) : !selectedStore ? (
          <motion.div 
            key="stores"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <button 
              onClick={handleBackToPlazas}
              className="flex items-center gap-2 text-mm-g font-bold mb-6 hover:translate-x-1 transition-transform"
            >
              <ArrowLeft className="w-5 h-5" /> Volver a plazas
            </button>

            <div className="bg-white p-8 rounded-[32px] border border-mm-crd shadow-sm mb-10 flex flex-col md:flex-row gap-8 items-center overflow-hidden relative">
              <div className="w-32 h-32 rounded-3xl flex items-center justify-center text-7xl shrink-0 overflow-hidden" style={{ backgroundColor: selectedPlaza.bg }}>
                {selectedPlaza.image ? (
                  <img src={selectedPlaza.image} alt={selectedPlaza.name} className="w-full h-full object-cover" />
                ) : (
                  selectedPlaza.emoji
                )}
              </div>
              <div className="flex-grow">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h1 className="text-4xl font-fraunces text-mm-g">{selectedPlaza.name}</h1>
                  <Badge variant={selectedPlaza.open ? 'success' : 'error'}>
                    {selectedPlaza.open ? 'Abierta ahora' : 'Cerrada'}
                  </Badge>
                </div>
                <p className="text-mm-txs mb-4 flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> {selectedPlaza.address}, {selectedPlaza.city}
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedPlaza.tags.map(tag => (
                    <React.Fragment key={tag}>
                      <Badge variant="oro" className="px-4 py-1">{tag}</Badge>
                    </React.Fragment>
                  ))}
                </div>

                <div className="flex flex-wrap gap-x-6 gap-y-2 mt-6 pt-6 border-t border-mm-crd/50 text-xs text-mm-txs">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-mm-gbg flex items-center justify-center">
                      <Clock className="w-4 h-4 text-mm-g" />
                    </div>
                    <div>
                      <p className="font-bold text-mm-txw uppercase text-[8px] leading-tight">Horario</p>
                      <p className="font-medium">{selectedPlaza.openTime} - {selectedPlaza.closeTime}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-mm-gbg flex items-center justify-center">
                      <Phone className="w-4 h-4 text-mm-g" />
                    </div>
                    <div>
                      <p className="font-bold text-mm-txw uppercase text-[8px] leading-tight">Teléfono</p>
                      <p className="font-medium">{selectedPlaza.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-mm-gbg flex items-center justify-center">
                      <Mail className="w-4 h-4 text-mm-g" />
                    </div>
                    <div>
                      <p className="font-bold text-mm-txw uppercase text-[8px] leading-tight">Email</p>
                      <p className="font-medium">{selectedPlaza.email}</p>
                    </div>
                  </div>
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${selectedPlaza.location?.lat},${selectedPlaza.location?.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 hover:bg-mm-gbg p-1 rounded-xl transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-mm-gbg flex items-center justify-center">
                      <Compass className="w-4 h-4 text-mm-g" />
                    </div>
                    <div>
                      <p className="font-bold text-mm-txw uppercase text-[8px] leading-tight">Ubicación</p>
                      <p className="font-medium">Ver en Mapa</p>
                    </div>
                  </a>
                  {selectedPlaza.website && (
                    <a 
                      href={selectedPlaza.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 hover:bg-mm-gbg p-1 rounded-xl transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-mm-gbg flex items-center justify-center">
                        <Globe className="w-4 h-4 text-mm-g" />
                      </div>
                      <div>
                        <p className="font-bold text-mm-txw uppercase text-[8px] leading-tight">Web</p>
                        <p className="font-medium">Visitar Sitio</p>
                      </div>
                    </a>
                  )}
                </div>
              </div>
              <div className="text-center md:text-right">
                <div className="text-3xl font-bold text-mm-oro flex items-center justify-center md:justify-end gap-2 mb-1">
                  <Star className="w-8 h-8 fill-mm-oro" /> {selectedPlaza.rating}
                </div>
                <p className="text-xs text-mm-txw font-bold uppercase tracking-widest">Calificación promedio</p>
              </div>
            </div>

            {plazaOffers.length > 0 && (
              <div className="mb-10">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-10 h-10 bg-mm-oro/10 rounded-xl flex items-center justify-center">
                    <Zap className="w-6 h-6 text-mm-oro" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-fraunces text-mm-g">Ofertas Imperdibles</h2>
                    <p className="text-xs text-mm-txw font-bold uppercase tracking-widest">Descuentos especiales hoy en {selectedPlaza.name}</p>
                  </div>
                </div>
                
                <div className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide">
                  {plazaOffers.map(offer => {
                    const store = state.stores.find(s => s.id === offer.storeId);
                    return (
                      <motion.div
                        key={offer.id}
                        whileHover={{ y: -4 }}
                        onClick={() => setSelectedOffer(offer)}
                        className="min-w-[300px] md:min-w-[350px] bg-white rounded-3xl border border-mm-crd shadow-sm overflow-hidden flex cursor-pointer group"
                      >
                        <div className="w-1/3 bg-mm-gbg relative overflow-hidden">
                          {offer.image ? (
                            <img src={offer.image} alt={offer.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-4xl">
                              {offer.emoji}
                            </div>
                          )}
                          <div className="absolute top-2 left-2">
                            <Badge variant="oro" className="shadow-lg">
                              {offer.type === 'percentage' ? `-${offer.value}%` : `-$${offer.value}`}
                            </Badge>
                          </div>
                        </div>
                        <div className="w-2/3 p-4 flex flex-col justify-between">
                          <div>
                            <p className="text-[10px] text-mm-txw font-bold uppercase tracking-tighter mb-1">{store?.name}</p>
                            <h3 className="font-bold text-mm-g leading-tight line-clamp-1">{offer.title}</h3>
                            <p className="text-xs text-mm-txs line-clamp-2 mt-1">{offer.desc}</p>
                          </div>
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-mm-crd/50">
                            <span className="text-[10px] text-mm-txw font-bold flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Expira pronto
                            </span>
                            <button 
                              onClick={() => store && setSelectedStore(store)}
                              className="text-xs font-bold text-mm-g hover:underline"
                            >
                              Ver tienda
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2 md:pb-0">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCat(cat)}
                    className={cn(
                      "px-5 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap",
                      activeCat === cat ? "bg-mm-g text-white shadow-md" : "bg-white text-mm-txs border border-mm-crd hover:border-mm-g"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="relative w-full md:w-72">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-mm-txw" />
                <input 
                  type="text" 
                  placeholder="Buscar tienda..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-mm-crd rounded-full py-2.5 pl-11 pr-4 text-sm outline-none focus:border-mm-g transition-all"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredStores.map(store => (
                <motion.div
                  key={store.id}
                  whileHover={{ y: -8 }}
                  onClick={() => setSelectedStore(store)}
                  className="bg-white p-6 rounded-3xl border border-mm-crd shadow-sm hover:shadow-xl transition-all cursor-pointer group"
                >
                  <div className="flex gap-4 mb-6">
                    <div className="w-16 h-16 bg-mm-gbg rounded-2xl flex items-center justify-center text-4xl group-hover:scale-110 transition-transform overflow-hidden shrink-0 relative">
                      {store.image ? (
                        <img src={store.image} alt={store.name} className="w-full h-full object-cover" />
                      ) : (
                        store.emoji
                      )}
                      <button 
                        onClick={(e) => toggleFavorite(e, store.id)}
                        className={cn(
                          "absolute top-1 right-1 p-1.5 rounded-full bg-white/80 backdrop-blur-sm shadow-sm transition-all transform opacity-0 group-hover:opacity-100",
                          state.buyerProfile.favoriteStores.includes(store.id) ? "text-r opacity-100" : "text-mm-txw hover:text-r"
                        )}
                      >
                        <Heart className={cn("w-4 h-4", state.buyerProfile.favoriteStores.includes(store.id) && "fill-r")} />
                      </button>
                    </div>
                    <div className="flex-grow">
                      <div className="flex justify-between items-start">
                        <h3 className="text-xl font-bold text-mm-g font-fraunces">{store.name}</h3>
                        <div className="flex items-center gap-1 text-mm-oro font-bold text-sm">
                          <Star className="w-4 h-4 fill-mm-oro" /> {store.rating}
                        </div>
                      </div>
                      <p className="text-xs text-mm-txw font-medium">{store.cat}</p>
                    </div>
                  </div>
                  <p className="text-sm text-mm-txs mb-6 line-clamp-2">{store.desc}</p>
                  <div className="flex items-center justify-between pt-4 border-t border-mm-crd">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-mm-txw uppercase font-bold tracking-tighter">Ubicación</span>
                      <span className="text-sm font-bold text-mm-g">Local {store.local}</span>
                    </div>
                    <Badge variant={store.open ? 'success' : 'error'}>
                      {store.open ? 'Abierta' : 'Cerrada'}
                    </Badge>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="products"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <button 
              onClick={handleBackToStores}
              className="flex items-center gap-2 text-mm-g font-bold mb-6 hover:translate-x-1 transition-transform"
            >
              <ArrowLeft className="w-5 h-5" /> Volver a tiendas
            </button>

            <div className="bg-white p-8 rounded-[32px] border border-mm-crd shadow-sm mb-10 flex flex-col md:flex-row gap-8 items-center">
              <div className="w-24 h-24 bg-mm-gbg rounded-3xl flex items-center justify-center text-6xl shrink-0 overflow-hidden border border-mm-crd relative group">
                {selectedStore.image ? (
                  <img src={selectedStore.image} alt={selectedStore.name} className="w-full h-full object-cover" />
                ) : (
                  selectedStore.emoji
                )}
                <button 
                  onClick={(e) => toggleFavorite(e, selectedStore.id)}
                  className={cn(
                    "absolute top-2 right-2 p-2 rounded-full bg-white/80 backdrop-blur-sm shadow-sm transition-all transform opacity-0 group-hover:opacity-100",
                    state.buyerProfile.favoriteStores.includes(selectedStore.id) ? "text-r opacity-100" : "text-mm-txw hover:text-r"
                  )}
                >
                  <Heart className={cn("w-5 h-5", state.buyerProfile.favoriteStores.includes(selectedStore.id) && "fill-r")} />
                </button>
              </div>
              <div className="flex-grow">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h1 className="text-3xl font-fraunces text-mm-g">{selectedStore.name}</h1>
                  <Badge variant={selectedStore.open ? 'success' : 'error'}>
                    {selectedStore.open ? 'Abierta ahora' : 'Cerrada'}
                  </Badge>
                </div>
                <p className="text-mm-txs mb-2 font-medium">{selectedStore.cat} • Local {selectedStore.local}</p>
                <p className="text-sm text-mm-txw">{selectedStore.desc}</p>

                <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4 pt-4 border-t border-mm-crd/30 text-[11px] text-mm-txs">
                  <div className="flex items-center gap-1.5 grayscale opacity-70">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="font-medium">{selectedStore.openTime} - {selectedStore.closeTime}</span>
                  </div>
                  <div className="flex items-center gap-1.5 grayscale opacity-70">
                    <Phone className="w-3.5 h-3.5" />
                    <span className="font-medium">{selectedStore.phone}</span>
                  </div>
                  <div className="flex items-center gap-1.5 grayscale opacity-70">
                    <Mail className="w-3.5 h-3.5" />
                    <span className="font-medium">{selectedStore.email}</span>
                  </div>
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${selectedStore.location?.lat},${selectedStore.location?.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 hover:text-mm-g transition-colors"
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span className="font-medium">Mapa</span>
                  </a>
                  {selectedStore.website && (
                    <a 
                      href={selectedStore.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 hover:text-mm-g transition-colors"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span className="font-medium">Web</span>
                    </a>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-center md:items-end gap-3">
                <div className="flex items-center gap-1 text-mm-oro font-bold text-2xl">
                  <Star className="w-6 h-6 fill-mm-oro" /> {selectedStore.rating}
                </div>
                <Button size="sm" variant="outline" className="rounded-xl">
                  <Phone className="w-4 h-4" /> Contactar
                </Button>
              </div>
            </div>

            <div className="flex border-b border-mm-crd mb-8">
              <button 
                onClick={() => setStoreTab('products')}
                className={cn(
                  "px-8 py-4 font-bold text-sm transition-all border-b-2",
                  storeTab === 'products' ? "border-mm-g text-mm-g bg-mm-gbg/20" : "border-transparent text-mm-txw hover:text-mm-g"
                )}
              >
                Productos ({filteredProducts.length})
              </button>
              <button 
                onClick={() => setStoreTab('reviews')}
                className={cn(
                  "px-8 py-4 font-bold text-sm transition-all border-b-2 flex items-center gap-2",
                  storeTab === 'reviews' ? "border-mm-g text-mm-g bg-mm-gbg/20" : "border-transparent text-mm-txw hover:text-mm-g"
                )}
              >
                Reseñas ({storeReviews.length})
              </button>
            </div>

            {storeTab === 'products' ? (
              <>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                  <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2 md:pb-0">
                    {categories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setActiveCat(cat)}
                        className={cn(
                          "px-5 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap",
                          activeCat === cat ? "bg-mm-g text-white shadow-md" : "bg-white text-mm-txs border border-mm-crd hover:border-mm-g"
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  <div className="relative w-full md:w-72">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-mm-txw" />
                    <input 
                      type="text" 
                      placeholder="Buscar producto..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white border border-mm-crd rounded-full py-2.5 pl-11 pr-4 text-sm outline-none focus:border-mm-g transition-all"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {filteredProducts.map(product => (
                    <motion.div
                      key={product.id}
                      whileHover={{ y: -8 }}
                      className="bg-white p-5 rounded-3xl border border-mm-crd shadow-sm hover:shadow-xl transition-all flex flex-col"
                    >
                      <div 
                        className="h-44 bg-mm-gbg rounded-2xl flex items-center justify-center text-6xl mb-4 cursor-pointer group overflow-hidden border border-mm-crd/50"
                        onClick={() => setSelectedProduct(product)}
                      >
                        {product.image ? (
                          <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        ) : (
                          <ImageIcon className="w-10 h-10 text-mm-txw group-hover:scale-110 transition-transform" />
                        )}
                      </div>
                      <div className="flex-grow">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-bold text-mm-g text-lg leading-tight">{product.name}</h4>
                          <button onClick={() => setSelectedProduct(product)} className="text-mm-txw hover:text-mm-g">
                            <Info className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-xs text-mm-txw mb-3">{product.cat} • {product.unit}</p>
                        
                        <div className="flex items-end justify-between mb-4">
                          <div>
                            {(() => {
                              const { price, original } = getProductPrice(product);
                              return (
                                <>
                                  {original && (
                                    <p className="text-[10px] text-mm-txw line-through decoration-r font-bold mb-0.5">
                                      {fmt(original)}
                                    </p>
                                  )}
                                  {state.userRole === 'wholesale' ? (
                                    <>
                                      <p className="text-[10px] text-blue font-bold uppercase tracking-tighter">Precio Mayorista</p>
                                      <p className="text-xl font-bold text-blue">{fmt(price)}</p>
                                    </>
                                  ) : (
                                    <p className="text-xl font-bold text-mm-g">{fmt(price)}</p>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                          <Badge variant={product.stock > 0 ? 'success' : 'error'} className="text-[10px]">
                            {product.stock > 0 ? `${product.stock} disp.` : 'Agotado'}
                          </Badge>
                        </div>
                      </div>

                      <Button 
                        onClick={() => {
                          const { price } = getProductPrice(product);
                          const finalProduct = { ...product };
                          if (state.userRole === 'wholesale') {
                            finalProduct.wsPrice = price;
                          } else {
                            finalProduct.retailPrice = price;
                          }
                          dispatch({ type: 'ADD_TO_CART', product: finalProduct });
                        }}
                        disabled={product.stock === 0}
                        className="w-full rounded-2xl py-3"
                        variant={state.userRole === 'wholesale' ? 'oro' : 'primary'}
                      >
                        <ShoppingCart className="w-4 h-4" /> Agregar
                      </Button>
                    </motion.div>
                  ))}
                </div>
              </>
            ) : (
              <div className="space-y-8">
                <div className="flex flex-col md:flex-row gap-6 items-start justify-between">
                  <div>
                    <h3 className="text-2xl font-fraunces text-mm-g mb-2">Opiniones de Clientes</h3>
                    <p className="text-mm-txs">Basado en {storeReviews.length} reseñas verificadas.</p>
                  </div>
                  {hasPurchased && !alreadyRated && (
                    <Button onClick={() => setIsRatingModalOpen(true)} className="rounded-2xl">
                      <Star className="w-4 h-4" /> Calificar Tienda
                    </Button>
                  )}
                  {alreadyRated && (
                    <Badge variant="success" className="py-2 px-4 rounded-xl">¡Ya has calificado esta tienda! ✨</Badge>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {storeReviews.length > 0 ? (
                    storeReviews.map(review => (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        key={review.id} 
                        className="bg-white p-6 rounded-[32px] border border-mm-crd shadow-sm"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-mm-gbg rounded-full flex items-center justify-center font-bold text-mm-g border border-mm-crd">
                              {review.buyerName.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-mm-g leading-none">{review.buyerName}</p>
                              <p className="text-[10px] text-mm-txw mt-1">{new Date(review.date).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="flex text-mm-oro">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} className={cn("w-3.5 h-3.5", i < review.stars ? "fill-mm-oro" : "text-mm-crd")} />
                            ))}
                          </div>
                        </div>
                        <p className="text-sm text-mm-txs italic">"{review.comment}"</p>
                      </motion.div>
                    ))
                  ) : (
                    <div className="md:col-span-2 text-center py-20 bg-mm-gbg/20 rounded-[40px] border border-dashed border-mm-crd">
                       <MessageSquare className="w-16 h-16 text-mm-txw mx-auto mb-4 opacity-40" />
                       <p className="text-mm-txs">Aún no hay reseñas para esta tienda.</p>
                       <p className="text-[10px] text-mm-txw uppercase mt-2">¡Sé el primero en comprar y calificar!</p>
                    </div>
                  )}
                </div>

                {hasPurchased && !alreadyRated && (
                  <div className="bg-mm-g/5 p-8 rounded-[40px] border border-mm-g/10 text-center">
                    <h4 className="text-xl font-fraunces text-mm-g mb-2">¿Cómo fue tu experiencia?</h4>
                    <p className="text-sm text-mm-txs mb-6">Como ya has comprado aquí, tu opinión es muy valiosa.</p>
                    <Button onClick={() => setIsRatingModalOpen(true)}>Escribir Reseña</Button>
                  </div>
                )}
                
                {!hasPurchased && (
                  <div className="bg-mm-gbg/30 p-8 rounded-[40px] border border-mm-crd/50 text-center">
                    <h4 className="text-lg font-fraunces text-mm-g mb-2">Calificaciones Verificadas</h4>
                    <p className="text-sm text-mm-txs">Para garantizar la autenticidad, solo los clientes que han realizado un pedido entregado pueden calificar esta tienda.</p>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rating Modal */}
      <AnimatePresence>
        {isRatingModalOpen && selectedStore && (
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
                {selectedStore.emoji}
              </div>

              <h2 className="text-3xl font-fraunces text-mm-g mb-2">
                ¿Qué tal tu compra?
              </h2>
              <p className="text-mm-txs mb-8 font-medium">Califica a <span className="text-mm-g font-bold">{selectedStore.name}</span></p>
              
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
                <Button className="flex-1" onClick={handleSaveReview}>
                  Enviar Reseña
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Product Detail Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProduct(null)}
              className="absolute inset-0 bg-mm-g/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-[40px] shadow-2xl overflow-hidden max-w-3xl w-full max-h-[90vh] flex flex-col md:flex-row"
            >
              <button 
                onClick={() => setSelectedProduct(null)}
                className="absolute top-6 right-6 p-2 hover:bg-mm-gbg rounded-full transition-colors z-10"
              >
                <X className="w-6 h-6 text-mm-txs" />
              </button>

              <div className="w-full md:w-1/2 bg-mm-gbg flex items-center justify-center p-0 overflow-hidden relative min-h-[300px]">
                {selectedProduct.image ? (
                  <img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-32 h-32 text-mm-txw animate-pop-in" />
                )}
              </div>

              <div className="w-full md:w-1/2 p-10 overflow-y-auto">
                <Badge variant="oro" className="mb-4">{selectedProduct.cat}</Badge>
                <h2 className="text-4xl font-fraunces text-mm-g mb-2">{selectedProduct.name}</h2>
                <p className="text-mm-txs mb-6 leading-relaxed">{selectedProduct.desc}</p>

                <div className="space-y-6 mb-8">
                  <div className="flex items-center justify-between p-4 bg-mm-gbg rounded-2xl">
                    <div>
                      <p className="text-xs text-mm-txw font-bold uppercase tracking-widest">Precio por {selectedProduct.unit}</p>
                      <div className="flex items-baseline gap-2">
                        {(() => {
                          const { price, original } = getProductPrice(selectedProduct);
                          return (
                            <>
                              <p className="text-3xl font-bold text-mm-g">{fmt(price)}</p>
                              {original && (
                                <p className="text-sm text-r line-through font-bold">{fmt(original)}</p>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    {state.userRole === 'wholesale' && (
                      <Badge variant="info" className="px-3 py-1">MAYORISTA</Badge>
                    )}
                  </div>

                  {state.userRole === 'wholesale' && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-mm-txs uppercase tracking-widest">Escalas de precio</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-3 border border-mm-crd rounded-xl bg-white">
                          <p className="text-[10px] text-mm-txw font-bold">20+ UNIDADES</p>
                          <p className="text-lg font-bold text-mm-g">{fmt(selectedProduct.ws20)}</p>
                        </div>
                        <div className="p-3 border border-mm-crd rounded-xl bg-white">
                          <p className="text-[10px] text-mm-txw font-bold">50+ UNIDADES</p>
                          <p className="text-lg font-bold text-mm-g">{fmt(selectedProduct.ws50)}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 bg-okl rounded-full flex items-center justify-center text-ok">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-mm-g">Stock disponible</p>
                        <p className="text-sm text-mm-txs">{selectedProduct.stock} {selectedProduct.unit}s</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 bg-bluel rounded-full flex items-center justify-center text-blue">
                        <Clock className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-mm-g">Entrega estimada</p>
                        <p className="text-sm text-mm-txs">Hoy mismo</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-mm-gbg/50 rounded-2xl space-y-3">
                    <p className="text-[10px] font-black uppercase text-mm-txw tracking-widest leading-none">Cantidad a llevar</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-grow flex items-center gap-1 bg-white p-1 rounded-xl border border-mm-crd">
                        <input 
                          type="number" 
                          step={modalUnitMode === 'alt' ? "1" : "0.01"}
                          min={modalUnitMode === 'alt' ? "1" : "0.01"}
                          value={modalUnitMode === 'alt' && selectedProduct.unit === 'kg' ? Math.round(modalQty * 1000) : modalQty}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const realQty = modalUnitMode === 'alt' && selectedProduct.unit === 'kg' ? val / 1000 : val;
                            setModalQty(realQty);
                          }}
                          className="flex-grow bg-transparent border-none py-2 px-3 text-lg font-bold text-mm-g appearance-none focus:ring-0"
                        />
                        {selectedProduct.unit === 'kg' ? (
                          <button
                            type="button"
                            onClick={() => {
                              const newMode = modalUnitMode === 'base' ? 'alt' : 'base';
                              setModalUnitMode(newMode);
                            }}
                            className="px-4 py-2 bg-mm-gbg rounded-lg text-xs font-black uppercase text-mm-g hover:bg-mm-gll transition-colors min-w-[48px]"
                          >
                            {modalUnitMode === 'alt' ? 'g' : 'kg'}
                          </button>
                        ) : (
                          <span className="text-xs font-bold text-mm-txw px-4 py-2 uppercase">{selectedProduct.unit}</span>
                        )}
                      </div>
                    </div>
                    {modalUnitMode === 'alt' && selectedProduct.unit === 'kg' && (
                       <p className="text-[10px] text-mm-txw italic">Equivale a {(modalQty).toFixed(3)} kg</p>
                    )}
                  </div>
                </div>

                <Button 
                  onClick={() => {
                    const { price } = getProductPrice(selectedProduct);
                    const finalProduct = { ...selectedProduct };
                    if (state.userRole === 'wholesale') {
                      finalProduct.wsPrice = price;
                    } else {
                      finalProduct.retailPrice = price;
                    }
                    dispatch({ 
                      type: 'ADD_TO_CART', 
                      product: finalProduct,
                      qty: modalQty 
                    });
                    setSelectedProduct(null);
                  }}
                  disabled={selectedProduct.stock === 0 || modalQty <= 0}
                  className="w-full py-4 text-lg"
                  size="lg"
                >
                  <ShoppingCart className="w-5 h-5 mr-2" /> Agregar al carrito — {fmt(getProductPrice(selectedProduct).price * modalQty)}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Promotion Detail Modal */}
      <AnimatePresence>
        {selectedOffer && (
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[200]">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedOffer(null)}
              className="absolute inset-0 bg-mm-g/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl relative z-[210] overflow-hidden"
            >
              <button 
                onClick={() => setSelectedOffer(null)}
                className="absolute top-6 right-6 p-2 rounded-full bg-mm-gbg hover:bg-mm-crd transition-colors z-10"
              >
                <X className="w-5 h-5 text-mm-txs" />
              </button>

              <div className="h-48 bg-mm-gbg flex items-center justify-center text-7xl relative">
                {selectedOffer.image ? (
                  <img src={selectedOffer.image} alt={selectedOffer.title} className="w-full h-full object-cover" />
                ) : selectedOffer.emoji}
                <div className="absolute top-6 left-6">
                  <Badge variant="oro" className="px-3 py-1 text-sm shadow-xl">
                    {selectedOffer.type === 'percentage' ? `${selectedOffer.value}% DESCUENTO` : `-$${selectedOffer.value.toLocaleString()} DTO`}
                  </Badge>
                </div>
              </div>

              <div className="p-8">
                <div className="mb-6">
                  <h3 className="text-2xl font-fraunces text-mm-g mb-2">{selectedOffer.title}</h3>
                  <p className="text-mm-txs">{selectedOffer.desc}</p>
                </div>

                <div className="space-y-4 mb-8">
                  <p className="text-xs font-bold text-mm-txw uppercase tracking-widest">Productos incluidos:</p>
                  <div className="space-y-3">
                    {selectedOfferProducts.map(p => {
                      const { price, original } = getProductPrice(p);
                      return (
                        <div key={p.id} className="flex items-center justify-between p-4 bg-mm-gbg rounded-2xl border border-mm-crd/50">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{p.emoji}</span>
                            <div>
                              <p className="font-bold text-mm-g text-sm">{p.name}</p>
                              <p className="text-xs text-mm-txs">Valor por {p.unit}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            {original && <p className="text-[10px] text-r line-through font-bold">{fmt(original)}</p>}
                            <p className="font-bold text-mm-g">{fmt(price)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <Button 
                    onClick={() => {
                      selectedOfferProducts.forEach(p => {
                        const { price } = getProductPrice(p);
                        const finalProduct = { ...p };
                        if (state.userRole === 'wholesale') {
                          finalProduct.wsPrice = price;
                        } else {
                          finalProduct.retailPrice = price;
                        }
                        dispatch({ type: 'ADD_TO_CART', product: finalProduct });
                      });
                      setSelectedOffer(null);
                    }}
                    className="w-full py-4 text-lg"
                  >
                    <ShoppingCart className="w-5 h-5" /> Agregar al carrito
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={() => {
                      dispatch({ 
                        type: 'SELECT_STORE', 
                        plazaId: selectedOffer.plazaId, 
                        storeId: selectedOffer.storeId 
                      });
                      setSelectedOffer(null);
                    }}
                    className="w-full text-mm-txs hover:text-mm-g"
                  >
                    Ver tienda completa
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AllPlazasView() {
  const { state, dispatch } = useApp();
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('Todas');
  
  const cities = ['Todas', ...new Set(state.plazas.map(p => p.city))];
  
  const filtered = useMemo(() => {
    return state.plazas.filter(p => 
      (city === 'Todas' || p.city === city) &&
      (p.name.toLowerCase().includes(search.toLowerCase()) || 
       p.address.toLowerCase().includes(search.toLowerCase()))
    );
  }, [state.plazas, search, city]);

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-fraunces text-mm-g mb-2">Todas las Plazas</h1>
        <p className="text-mm-txs">Explora los centros de abastecimiento más frescos de la región.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-mm-txw" />
          <input 
            type="text" 
            placeholder="Buscar por nombre o dirección..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-mm-crd rounded-full py-2.5 pl-11 pr-4 text-sm outline-none focus:border-mm-g transition-all"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          {cities.map(c => (
            <button
              key={c}
              onClick={() => setCity(c)}
              className={cn(
                "px-5 py-2.5 rounded-full text-sm font-bold transition-all whitespace-nowrap",
                city === c ? "bg-mm-g text-white shadow-md" : "bg-white border border-mm-crd text-mm-txs hover:border-mm-g"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filtered.map(plaza => (
          <motion.div
            key={plaza.id}
            whileHover={{ y: -8 }}
            onClick={() => {
              dispatch({ 
                type: 'SELECT_STORE', 
                plazaId: plaza.id 
              });
            }}
            className="bg-white rounded-3xl border border-mm-crd shadow-sm hover:shadow-xl transition-all cursor-pointer overflow-hidden group"
          >
            <div className="h-40 flex items-center justify-center text-6xl group-hover:scale-105 transition-transform overflow-hidden relative" style={{ backgroundColor: plaza.bg }}>
              {plaza.image ? (
                <img src={plaza.image} alt={plaza.name} className="w-full h-full object-cover" />
              ) : (
                plaza.emoji
              )}
            </div>
            <div className="p-6">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-xl font-bold text-mm-g font-fraunces">{plaza.name}</h3>
                <div className="flex items-center gap-1 text-mm-oro font-bold text-sm">
                  <Star className="w-4 h-4 fill-mm-oro" /> {plaza.rating}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-mm-txw mb-4">
                <MapPin className="w-3.5 h-3.5" /> {plaza.city} • {plaza.address}
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-mm-crd">
                <div className="flex items-center gap-2 text-xs font-bold text-mm-txs">
                  <StoreIcon className="w-4 h-4" /> {plaza.stores} tiendas
                </div>
                <Badge variant={plaza.open ? 'success' : 'error'}>
                  {plaza.open ? 'Abierta' : 'Cerrada'}
                </Badge>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      
      {filtered.length === 0 && (
        <div className="text-center py-20">
          <div className="w-20 h-20 bg-mm-gbg rounded-full flex items-center justify-center mx-auto mb-4 text-4xl">🔎</div>
          <h3 className="text-xl font-bold text-mm-g font-fraunces">No encontramos plazas</h3>
          <p className="text-mm-txs">Intenta con otros términos de búsqueda o filtros.</p>
        </div>
      )}
    </div>
  );
}

export function AllStoresView() {
  const { state, dispatch } = useApp();
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState('Todas');
  const [plazaId, setPlazaId] = useState<number | 'all'>('all');

  const categories = ['Todas', 'Verduras', 'Frutas', 'Especias', 'Granos', 'Carnes', 'Lácteos'];

  const filtered = useMemo(() => {
    return state.stores.filter(s => 
      (activeCat === 'Todas' || s.cat.includes(activeCat)) &&
      (plazaId === 'all' || s.plazaId === plazaId) &&
      (s.name.toLowerCase().includes(search.toLowerCase()) || 
       s.desc.toLowerCase().includes(search.toLowerCase()))
    );
  }, [state.stores, search, activeCat, plazaId]);

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-fraunces text-mm-g mb-2">Todas las Tiendas</h1>
        <p className="text-mm-txs">Nuestros expertos tenderos listos para servirte.</p>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-mm-txw" />
            <input 
              type="text" 
              placeholder="Buscar tienda por nombre o especialidad..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-mm-crd rounded-full py-2.5 pl-11 pr-4 text-sm outline-none focus:border-mm-g transition-all"
            />
          </div>
          <select 
            className="px-4 py-2.5 rounded-full border border-mm-crd text-sm outline-none focus:border-mm-g bg-white"
            value={plazaId}
            onChange={(e) => setPlazaId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          >
            <option value="all">Todas las Plazas</option>
            {state.plazas.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setActiveCat(c)}
              className={cn(
                "px-5 py-2.5 rounded-full text-sm font-bold transition-all whitespace-nowrap",
                activeCat === c ? "bg-mm-g text-white shadow-md" : "bg-white border border-mm-crd text-mm-txs hover:border-mm-g"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filtered.map(store => {
          const plaza = state.plazas.find(p => p.id === store.plazaId);
          return (
            <motion.div
              key={store.id}
              whileHover={{ y: -5 }}
              onClick={() => {
                dispatch({ 
                  type: 'SELECT_STORE', 
                  plazaId: store.plazaId, 
                  storeId: store.id 
                });
              }}
              className="bg-white rounded-3xl border border-mm-crd shadow-sm hover:shadow-xl transition-all cursor-pointer overflow-hidden flex flex-col group h-full"
            >
              <div className="h-32 bg-mm-gbg flex items-center justify-center text-5xl relative">
                {store.image ? (
                  <img src={store.image} alt={store.name} className="w-full h-full object-cover" />
                ) : (
                  store.emoji
                )}
                <div className="absolute top-3 right-3">
                  <Badge variant="oro" className="shadow-lg backdrop-blur-sm bg-white/80">
                    <Star className="w-3 h-3 fill-mm-oro inline mr-1" /> {store.rating}
                  </Badge>
                </div>
              </div>
              <div className="p-5 flex flex-col flex-grow">
                <div className="flex-grow">
                  <div className="flex items-center gap-1.5 text-[10px] text-mm-txw font-bold uppercase tracking-widest mb-1.5">
                    <MapPin className="w-3 h-3" /> {plaza?.name}
                  </div>
                  <h3 className="text-lg font-bold text-mm-g mb-1 group-hover:text-mm-oro transition-colors leading-snug">{store.name}</h3>
                  <p className="text-xs text-mm-txw font-medium mb-3">{store.cat}</p>
                </div>
                <div className="pt-3 border-t border-mm-crd flex items-center justify-between mt-auto">
                  <span className="text-[10px] text-mm-txw uppercase font-bold tracking-tighter">Local {store.local}</span>
                  <Badge variant={store.open ? 'success' : 'error'}>
                    {store.open ? 'Abierto' : 'Cerrado'}
                  </Badge>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export function AllProductsView() {
  const { state, dispatch } = useApp();
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState('Todas');
  const [minPrice, setMinPrice] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number>(100000);

  const categories = ['Todas', 'Verduras', 'Frutas', 'Especias', 'Granos', 'Carnes', 'Lácteos'];

  const getPriceInfo = (product: Product) => {
    const basePrice = state.userRole === 'wholesale' ? product.wsPrice : product.retailPrice;
    const offer = state.offers.find(o => o.status === 'active' && o.productIds.includes(product.id));
    
    if (!offer) return { price: basePrice, original: null };
    
    let discounted = basePrice;
    if (offer.type === 'percentage') {
      discounted = basePrice * (1 - offer.value / 100);
    } else {
      discounted = Math.max(0, basePrice - offer.value);
    }
    
    return { price: Math.floor(discounted), original: basePrice };
  };

  const filtered = useMemo(() => {
    return state.products.filter(p => {
      const { price } = getPriceInfo(p);
      return (activeCat === 'Todas' || p.cat === activeCat) &&
             (price >= minPrice && price <= maxPrice) &&
             (p.name.toLowerCase().includes(search.toLowerCase()) || 
              p.desc.toLowerCase().includes(search.toLowerCase()));
    });
  }, [state.products, search, activeCat, minPrice, maxPrice]);

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-fraunces text-mm-g mb-2">Todos los Productos</h1>
        <p className="text-mm-txs">Lo mejor del campo en un solo lugar.</p>
      </div>

      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="relative flex-grow">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-mm-txw" />
            <input 
              type="text" 
              placeholder="¿Qué buscas hoy?" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-mm-crd rounded-full py-2.5 pl-11 pr-4 text-sm outline-none focus:border-mm-g transition-all"
            />
          </div>
          <div className="flex items-center gap-4 bg-white p-2 border border-mm-crd rounded-full px-4">
             <span className="text-xs font-bold text-mm-txw uppercase tracking-widest whitespace-nowrap">Precio:</span>
             <input 
                type="number" 
                value={minPrice} 
                onChange={e => setMinPrice(Number(e.target.value))}
                className="w-20 text-xs font-bold bg-mm-gbg/50 rounded-lg p-1.5 outline-none focus:ring-1 ring-mm-g"
                placeholder="Min"
             />
             <span className="text-mm-txw">-</span>
             <input 
                type="number" 
                value={maxPrice} 
                onChange={e => setMaxPrice(Number(e.target.value))}
                className="w-20 text-xs font-bold bg-mm-gbg/50 rounded-lg p-1.5 outline-none focus:ring-1 ring-mm-g"
                placeholder="Max"
             />
          </div>
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setActiveCat(c)}
              className={cn(
                "px-5 py-2.5 rounded-full text-sm font-bold transition-all whitespace-nowrap",
                activeCat === c ? "bg-mm-g text-white shadow-md" : "bg-white border border-mm-crd text-mm-txs hover:border-mm-g"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
        {filtered.map(product => {
          const { price, original } = getPriceInfo(product);
          const store = state.stores.find(s => s.id === product.storeId);
          
          return (
            <motion.div
              key={product.id}
              whileHover={{ y: -5 }}
              onClick={() => {
                const store = state.stores.find(s => s.id === product.storeId);
                if (store) {
                  dispatch({ 
                    type: 'SELECT_STORE', 
                    plazaId: store.plazaId, 
                    storeId: store.id 
                  });
                }
              }}
              className="bg-white rounded-[28px] border border-mm-crd shadow-sm hover:shadow-xl transition-all cursor-pointer overflow-hidden flex flex-col group border-b-4 border-b-mm-crd hover:border-b-mm-g active:scale-95 duration-200"
            >
              <div className="h-40 bg-mm-gbg flex items-center justify-center text-5xl relative overflow-hidden">
                {product.image ? (
                  <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                ) : (
                  <span className="group-hover:scale-125 transition-transform duration-500">{product.emoji}</span>
                )}
                {original && (
                  <div className="absolute top-2 left-2">
                    <Badge variant="oro" className="animate-pulse shadow-md">OFERTA</Badge>
                  </div>
                )}
              </div>
              <div className="p-4 flex flex-col flex-grow" onClick={(e) => e.stopPropagation()}>
                <div className="flex-grow">
                  <p className="text-[10px] text-mm-txw font-bold uppercase tracking-tighter mb-1 line-clamp-1">{store?.name}</p>
                  <h3 className="font-bold text-mm-g mb-0.5 line-clamp-1 group-hover:text-mm-oro transition-colors text-sm sm:text-base">{product.name}</h3>
                  <p className="text-[10px] text-mm-txw mb-3 font-medium uppercase tracking-widest">{product.cat}</p>
                </div>
                
                <div className="flex items-center justify-between pt-1 border-t border-mm-crd/50 gap-2">
                  <div className="flex flex-col">
                    {original && (
                      <p className="text-[10px] text-mm-txw line-through decoration-r font-bold">
                        {fmt(original)}
                      </p>
                    )}
                    <p className="text-sm font-bold text-mm-g">
                      {fmt(price)}
                      <span className="text-[10px] text-mm-txw ml-0.5">/{product.unit}</span>
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                        const finalProduct = { ...product };
                        if (state.userRole === 'wholesale') {
                          finalProduct.wsPrice = price;
                        } else {
                          finalProduct.retailPrice = price;
                        }
                        dispatch({ type: 'ADD_TO_CART', product: finalProduct });
                    }}
                    className="w-8 h-8 rounded-full bg-mm-g text-white flex items-center justify-center hover:bg-mm-oro hover:scale-110 transition-all shadow-sm active:scale-90"
                  >
                    <ShoppingCart className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export function AllOffersView() {
  const { state, dispatch } = useApp();
  const [search, setSearch] = useState('');
  const [type, setType] = useState<'all' | 'percentage' | 'fixed'>('all');
  const [plazaId, setPlazaId] = useState<number | 'all'>('all');
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);

  const getProductPrice = (product: Product) => {
    const basePrice = state.userRole === 'wholesale' ? product.wsPrice : product.retailPrice;
    const offer = state.offers.find(o => o.status === 'active' && o.productIds.includes(product.id));
    
    if (!offer) return { price: basePrice, original: null };
    
    let discounted = basePrice;
    if (offer.type === 'percentage') {
      discounted = basePrice * (1 - offer.value / 100);
    } else {
      discounted = Math.max(0, basePrice - offer.value);
    }
    
    return { price: Math.floor(discounted), original: basePrice };
  };

  const filtered = useMemo(() => {
    return state.offers.filter(o => 
      (type === 'all' || o.type === type) &&
      (plazaId === 'all' || o.plazaId === plazaId) &&
      (o.title.toLowerCase().includes(search.toLowerCase()) || 
       o.desc.toLowerCase().includes(search.toLowerCase())) &&
      o.status === 'active'
    );
  }, [state.offers, search, type, plazaId]);

  const selectedOfferProducts = useMemo(() => {
    if (!selectedOffer) return [];
    return state.products.filter(p => selectedOffer.productIds.includes(p.id));
  }, [selectedOffer, state.products]);

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-fraunces text-mm-g mb-2">Promociones y Ofertas 🔥</h1>
          <p className="text-mm-txs">Ahorra con los mejores descuentos de nuestras plazas asociadas.</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-mm-txw" />
            <input 
              type="text" 
              placeholder="Buscar ofertas..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-mm-crd rounded-full py-2.5 pl-11 pr-4 text-sm outline-none focus:border-mm-g transition-all"
            />
          </div>
          <div className="flex gap-2">
            <select 
              className="px-4 py-2.5 rounded-full border border-mm-crd text-sm outline-none focus:border-mm-g bg-white"
              value={type}
              onChange={(e) => setType(e.target.value as any)}
            >
              <option value="all">Cualquier Tipo</option>
              <option value="percentage">Porcentaje (%)</option>
              <option value="fixed">Fijo ($)</option>
            </select>
            <select 
              className="px-4 py-2.5 rounded-full border border-mm-crd text-sm outline-none focus:border-mm-g bg-white"
              value={plazaId}
              onChange={(e) => setPlazaId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            >
              <option value="all">Todas las Plazas</option>
              {state.plazas.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(offer => {
          const store = state.stores.find(s => s.id === offer.storeId);
          const plaza = state.plazas.find(p => p.id === offer.plazaId);
          
          return (
            <motion.div
              key={offer.id}
              whileHover={{ y: -5 }}
              className="bg-white rounded-[32px] border border-mm-crd shadow-sm overflow-hidden flex h-48 group cursor-pointer relative"
              onClick={() => {
                setSelectedOffer(offer);
              }}
            >
              <div className="w-2/5 bg-mm-gbg flex items-center justify-center text-5xl relative overflow-hidden group-hover:scale-105 transition-transform duration-500">
                {offer.image ? (
                  <img src={offer.image} alt={offer.title} className="w-full h-full object-cover" />
                ) : (
                  offer.emoji
                )}
                <div className="absolute top-4 left-4">
                    <Badge variant="oro" className="shadow-lg animate-bounce">
                      {offer.type === 'percentage' ? `${offer.value}% OFF` : `-$${offer.value.toLocaleString()}`}
                    </Badge>
                </div>
              </div>
              
              <div className="w-3/5 p-6 flex flex-col justify-between">
                <div>
                  <div className="flex flex-col mb-2">
                    <span className="text-[10px] text-mm-txw font-bold uppercase tracking-widest leading-none mb-1">{plaza?.name}</span>
                    <Badge variant="oro" className="w-fit text-[9px] h-4 flex items-center">{store?.name}</Badge>
                  </div>
                  <h3 className="font-bold text-mm-g text-lg leading-tight mb-2 line-clamp-2 group-hover:text-mm-oro transition-colors">{offer.title}</h3>
                  <p className="text-xs text-mm-txs line-clamp-2 leading-relaxed">{offer.desc}</p>
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t border-mm-crd/50">
                   <div className="flex items-center gap-2 text-mm-txw">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-tighter">Vence: {new Date(offer.endDate).toLocaleDateString()}</span>
                   </div>
                   <div className="w-8 h-8 rounded-full bg-mm-g/10 flex items-center justify-center text-mm-g group-hover:bg-mm-g group-hover:text-white transition-all">
                      <ChevronRight className="w-4 h-4" />
                   </div>
                </div>
              </div>

              <div className="absolute -bottom-4 -right-4 w-12 h-12 bg-mm-oro/5 rounded-full blur-xl group-hover:scale-150 transition-transform" />
            </motion.div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20 bg-mm-gbg/30 rounded-[40px] border border-dashed border-mm-crd">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
             <Tag className="w-10 h-10 text-mm-txw" />
          </div>
          <h3 className="text-2xl font-bold text-mm-g font-fraunces mb-2">No hay ofertas actuales</h3>
          <p className="text-mm-txs max-w-xs mx-auto text-center">Intenta ajustando tus filtros para encontrar los mejores descuentos.</p>
          <Button 
            variant="ghost" 
            className="mt-6 text-mm-g font-bold"
            onClick={() => { setSearch(''); setType('all'); setPlazaId('all'); }}
          >
            Limpiar filtros
          </Button>
        </div>
      )}

      {/* Promotion Detail Modal */}
      <AnimatePresence>
        {selectedOffer && (
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[200]">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedOffer(null)}
              className="absolute inset-0 bg-mm-g/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl relative z-[210] overflow-hidden"
            >
              <button 
                onClick={() => setSelectedOffer(null)}
                className="absolute top-6 right-6 p-2 rounded-full bg-mm-gbg hover:bg-mm-crd transition-colors z-10"
              >
                <X className="w-5 h-5 text-mm-txs" />
              </button>

              <div className="h-48 bg-mm-gbg flex items-center justify-center text-7xl relative">
                {selectedOffer.image ? (
                  <img src={selectedOffer.image} alt={selectedOffer.title} className="w-full h-full object-cover" />
                ) : selectedOffer.emoji}
                <div className="absolute top-6 left-6">
                  <Badge variant="oro" className="px-3 py-1 text-sm shadow-xl">
                    {selectedOffer.type === 'percentage' ? `${selectedOffer.value}% DESCUENTO` : `-$${selectedOffer.value.toLocaleString()} DTO`}
                  </Badge>
                </div>
              </div>

              <div className="p-8">
                <div className="mb-6">
                  <h3 className="text-2xl font-fraunces text-mm-g mb-2">{selectedOffer.title}</h3>
                  <p className="text-mm-txs">{selectedOffer.desc}</p>
                </div>

                <div className="space-y-4 mb-8">
                  <p className="text-xs font-bold text-mm-txw uppercase tracking-widest">Productos incluidos:</p>
                  <div className="space-y-3">
                    {selectedOfferProducts.map(p => {
                      const { price, original } = getProductPrice(p);
                      return (
                        <div key={p.id} className="flex items-center justify-between p-4 bg-mm-gbg rounded-2xl border border-mm-crd/50">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{p.emoji}</span>
                            <div>
                              <p className="font-bold text-mm-g text-sm">{p.name}</p>
                              <p className="text-xs text-mm-txs">Valor por {p.unit}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            {original && <p className="text-[10px] text-r line-through font-bold">{fmt(original)}</p>}
                            <p className="font-bold text-mm-g">{fmt(price)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <Button 
                    onClick={() => {
                      selectedOfferProducts.forEach(p => {
                        const { price } = getProductPrice(p);
                        const finalProduct = { ...p };
                        if (state.userRole === 'wholesale') {
                          finalProduct.wsPrice = price;
                        } else {
                          finalProduct.retailPrice = price;
                        }
                        dispatch({ type: 'ADD_TO_CART', product: finalProduct });
                      });
                      setSelectedOffer(null);
                    }}
                    className="w-full py-4 text-lg"
                  >
                    <ShoppingCart className="w-5 h-5" /> Agregar al carrito
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={() => {
                      dispatch({ 
                        type: 'SELECT_STORE', 
                        plazaId: selectedOffer.plazaId, 
                        storeId: selectedOffer.storeId 
                      });
                      setSelectedOffer(null);
                    }}
                    className="w-full text-mm-txs hover:text-mm-g"
                  >
                    Ver tienda completa
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}


