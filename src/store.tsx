'use client';
import React, { createContext, useContext, useReducer, ReactNode, useEffect } from 'react';
import { createSupabaseBrowserClient } from '../lib/supabase/client'; // ajusta la ruta a tu cliente browser
import { 
  Plaza, Store, Product, CartItem, Order, AppNotification, BuyerProfile, RoleKey, Offer, MasterProduct, StoreReview, Sale, SaleStatus 
} from './types';
import { SEED_PLAZAS, SEED_STORES, SEED_PRODUCTS, DEFAULT_BUYER_PROFILE, SEED_CATALOG, SEED_REVIEWS } from './constants';

interface AppState {
  plazas: Plaza[];
  stores: Store[];
  products: Product[];
  cart: CartItem[];
  orders: Order[];
  notifs: AppNotification[];
  buyerProfile: BuyerProfile;
  userRole: RoleKey;
  isLoggedIn: boolean;
  currentSection: string;
  offers: Offer[];
  catalog: MasterProduct[];
  reviews: StoreReview[];
  sales: Sale[];
  selectedPlazaId?: number;
  selectedStoreId?: number;
  // Flag para saber si ya intentamos hidratar desde Supabase
  _hydrated: boolean;
}

type AppAction =
  | { type: 'SET_ROLE'; role: RoleKey }
  | { type: 'LOGIN'; role: RoleKey; profile?: Partial<BuyerProfile> }
  | { type: 'LOGOUT' }
  | { type: 'HYDRATE'; role: RoleKey; profile: Partial<BuyerProfile>; cart?: CartItem[] }
  | { type: 'HYDRATE_GUEST'; cart?: CartItem[] }
  | { type: 'SET_SECTION'; section: string }
  | { type: 'ADD_TO_CART'; product: Product; qty?: number }
  | { type: 'REMOVE_FROM_CART'; productId: number }
  | { type: 'UPDATE_CART_QTY'; productId: number; qty: number }
  | { type: 'CLEAR_CART' }
  | { type: 'RESTORE_CART'; items: CartItem[] }
  | { type: 'PLACE_ORDER'; orders: Order[] }
  | { type: 'UPDATE_ORDER_STATUS'; orderId: string; status: Order['status'] }
  | { type: 'ADD_NOTIF'; notif: AppNotification }
  | { type: 'READ_NOTIF'; notifId: string }
  | { type: 'READ_ALL_NOTIFS' }
  | { type: 'UPDATE_BUYER_PROFILE'; profile: Partial<BuyerProfile> }
  | { type: 'ADD_PRODUCT'; product: Product }
  | { type: 'UPDATE_PRODUCT'; product: Product }
  | { type: 'DELETE_PRODUCT'; productId: number }
  | { type: 'ADD_PLAZA'; plaza: Plaza }
  | { type: 'UPDATE_PLAZA'; plaza: Plaza }
  | { type: 'DELETE_PLAZA'; plazaId: number }
  | { type: 'ADD_STORE'; store: Store }
  | { type: 'UPDATE_STORE'; store: Store }
  | { type: 'DELETE_STORE'; storeId: number }
  | { type: 'ADD_OFFER'; offer: Offer }
  | { type: 'UPDATE_OFFER'; offer: Offer }
  | { type: 'DELETE_OFFER'; offerId: number }
  | { type: 'ADD_CATALOG_ITEM'; item: MasterProduct }
  | { type: 'UPDATE_CATALOG_ITEM'; item: MasterProduct }
  | { type: 'DELETE_CATALOG_ITEM'; id: number }
  | { type: 'ADD_REVIEW'; review: StoreReview }
  | { type: 'ADD_SALE'; sale: Sale }
  | { type: 'UPDATE_SALE_STATUS'; saleId: number; status: SaleStatus }
  | { type: 'SELECT_STORE'; plazaId: number; storeId?: number }
  | { type: 'CLEAR_STORE_SELECTION' };

// Mapea el nombre del rol de Supabase al RoleKey de la app
const roleNameToKey: Record<string, RoleKey> = {
  admin: 'admin',
  superadmin: 'admin',
  provider: 'provider',
  delivery: 'delivery',
  wholesale: 'wholesale',
  retail: 'retail',
};

const initialState: AppState = {
  plazas: SEED_PLAZAS,
  stores: SEED_STORES,
  products: SEED_PRODUCTS,
  cart: [],
  orders: [
    {
      id: "MM-102938",
      date: new Date().toISOString(),
      storeId: 1,
      storeName: "Frutería Don Chucho",
      storeEmoji: "🍎",
      items: [
        { id: 1, name: "Manzana Roja", qty: 5, price: 2500, unit: "und", emoji: "🍎" },
        { id: 2, name: "Banano Maduro", qty: 12, price: 800, unit: "und", emoji: "🍌" }
      ],
      total: 22100,
      status: 'on_the_way',
      buyerId: 'user-1',
      address: 'Cra 70 #45-12, Laureles',
      paymentMethod: 'Efectivo'
    },
    {
      id: "MM-485721",
      date: "2024-05-08T13:00:00.000Z",
      storeId: 2,
      storeName: "Carnes El Novillo",
      storeEmoji: "🥩",
      items: [
        { id: 5, name: "Punta de Anca", qty: 2, price: 35000, unit: "kg", emoji: "🥩" }
      ],
      total: 70000,
      status: 'preparing',
      buyerId: 'user-1',
      address: 'Cl 10 #43-01, El Poblado',
      paymentMethod: 'Tarjeta **** 4422'
    }
  ],
  notifs: [],
  buyerProfile: DEFAULT_BUYER_PROFILE,
  userRole: 'retail',
  isLoggedIn: false,
  currentSection: 'home',
  catalog: SEED_CATALOG,
  reviews: SEED_REVIEWS,
  sales: [],
  offers: [
    {
      id: 1,
      storeId: 1,
      plazaId: 1,
      title: 'Festival del Tomate',
      desc: '30% de descuento en todos los tomates',
      type: 'percentage',
      value: 30,
      productIds: [3],
      status: 'active',
      endDate: '2026-04-30',
      emoji: '🍅'
    },
    {
      id: 2,
      storeId: 2,
      plazaId: 1,
      title: 'Combo Asado',
      desc: '$10,000 de descuento en Punta de Anca',
      type: 'fixed',
      value: 10000,
      productIds: [5],
      status: 'active',
      endDate: '2026-04-28',
      emoji: '🥩'
    }
  ],
  _hydrated: false,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'HYDRATE':
      // Solo hidrata una vez y solo si hay sesión activa
      return {
        ...state,
        isLoggedIn: true,
        userRole: action.role,
        buyerProfile: { ...state.buyerProfile, ...action.profile },
        cart: action.cart ?? state.cart,
        _hydrated: true,
      };

    case 'HYDRATE_GUEST':
      return {
        ...state,
        isLoggedIn: false,
        cart: action.cart ?? state.cart,
        _hydrated: true,
      };

    case 'SET_ROLE': {
      const defaultSection = action.role === 'admin' ? 'admin_analytics' : 
                            action.role === 'provider' ? 'dashboard' :
                            action.role === 'delivery' ? 'routes' : 'home';
      return { ...state, userRole: action.role, currentSection: defaultSection };
    }

    case 'LOGIN':
      return { 
        ...state, 
        isLoggedIn: true, 
        userRole: action.role, 
        currentSection: action.role === 'admin' ? 'admin_analytics' : 'home',
        buyerProfile: action.profile ? { ...state.buyerProfile, ...action.profile } : state.buyerProfile,
        _hydrated: true,
      };

    case 'LOGOUT':
      return { 
        ...state, 
        isLoggedIn: false, 
        cart: [], 
        currentSection: 'home',
        buyerProfile: DEFAULT_BUYER_PROFILE,
        _hydrated: true, // ya sabemos que no hay sesión
      };

    case 'SET_SECTION':
      return { ...state, currentSection: action.section };

    case 'ADD_TO_CART': {
      const existing = state.cart.find(i => i.id === action.product.id);
      const qtyToAdd = action.qty !== undefined ? action.qty : 1;
      if (existing) {
        return {
          ...state,
          cart: state.cart.map(i => i.id === action.product.id ? { ...i, qty: i.qty + qtyToAdd } : i)
        };
      }
      return { ...state, cart: [...state.cart, { ...action.product, qty: qtyToAdd }] };
    }

    case 'REMOVE_FROM_CART':
      return { ...state, cart: state.cart.filter(i => i.id !== action.productId) };

    case 'UPDATE_CART_QTY':
      return {
        ...state,
        cart: state.cart.map(i => i.id === action.productId ? { ...i, qty: Math.max(0, action.qty) } : i).filter(i => i.qty > 0)
      };

    case 'CLEAR_CART':
      return { ...state, cart: [] };

    case 'RESTORE_CART':
      return { ...state, cart: action.items };

    case 'PLACE_ORDER':
      return { ...state, orders: [...state.orders, ...action.orders], cart: [] };

    case 'UPDATE_ORDER_STATUS':
      return {
        ...state,
        orders: state.orders.map(o => o.id === action.orderId ? { ...o, status: action.status } : o)
      };

    case 'ADD_NOTIF':
      return { ...state, notifs: [action.notif, ...state.notifs] };

    case 'READ_NOTIF':
      return {
        ...state,
        notifs: state.notifs.map(n => n.id === action.notifId ? { ...n, read: true } : n)
      };

    case 'READ_ALL_NOTIFS':
      return { ...state, notifs: state.notifs.map(n => ({ ...n, read: true })) };

    case 'UPDATE_BUYER_PROFILE':
      return { ...state, buyerProfile: { ...state.buyerProfile, ...action.profile } };

    case 'ADD_PRODUCT':
      return { ...state, products: [...state.products, action.product] };

    case 'UPDATE_PRODUCT':
      return {
        ...state,
        products: state.products.map(p => p.id === action.product.id ? action.product : p)
      };

    case 'DELETE_PRODUCT':
      return { ...state, products: state.products.filter(p => p.id !== action.productId) };

    case 'ADD_PLAZA':
      return { ...state, plazas: [...state.plazas, action.plaza] };

    case 'UPDATE_PLAZA':
      return {
        ...state,
        plazas: state.plazas.map(p => p.id === action.plaza.id ? action.plaza : p)
      };

    case 'DELETE_PLAZA':
      return { ...state, plazas: state.plazas.filter(p => p.id !== action.plazaId) };

    case 'ADD_STORE':
      return { ...state, stores: [...state.stores, action.store] };

    case 'UPDATE_STORE':
      return {
        ...state,
        stores: state.stores.map(s => s.id === action.store.id ? action.store : s)
      };

    case 'DELETE_STORE':
      return { ...state, stores: state.stores.filter(s => s.id !== action.storeId) };

    case 'ADD_OFFER':
      return { ...state, offers: [...state.offers, action.offer] };

    case 'UPDATE_OFFER':
      return {
        ...state,
        offers: state.offers.map(o => o.id === action.offer.id ? action.offer : o)
      };

    case 'DELETE_OFFER':
      return { ...state, offers: state.offers.filter(o => o.id !== action.offerId) };

    case 'ADD_CATALOG_ITEM':
      return { ...state, catalog: [...state.catalog, action.item] };

    case 'UPDATE_CATALOG_ITEM':
      return {
        ...state,
        catalog: state.catalog.map(i => i.id === action.item.id ? action.item : i)
      };

    case 'DELETE_CATALOG_ITEM':
      return { ...state, catalog: state.catalog.filter(i => i.id !== action.id) };

    case 'ADD_REVIEW': {
      const newReviews = [...state.reviews, action.review];
      const storeReviews = newReviews.filter(r => r.storeId === action.review.storeId);
      const avg = storeReviews.reduce((acc, r) => acc + r.stars, 0) / storeReviews.length;
      return {
        ...state,
        reviews: newReviews,
        stores: state.stores.map(s => s.id === action.review.storeId ? { 
          ...s, 
          rating: Number(avg.toFixed(1)), 
          reviewCount: storeReviews.length 
        } : s)
      };
    }

    case 'ADD_SALE':
      return { ...state, sales: [action.sale, ...state.sales] };

    case 'UPDATE_SALE_STATUS':
      return {
        ...state,
        sales: state.sales.map(s => s.id === action.saleId ? { ...s, status: action.status } : s)
      };

    case 'SELECT_STORE':
      return { 
        ...state, 
        selectedPlazaId: action.plazaId, 
        selectedStoreId: action.storeId || undefined,
        currentSection: 'home'
      };

    case 'CLEAR_STORE_SELECTION':
      return { ...state, selectedPlazaId: undefined, selectedStoreId: undefined };

    default:
      return state;
  }
}

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Al montar, verifica si hay sesión activa en Supabase y rehidrata el store
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    const hydrate = async () => {
      let savedCart: CartItem[] = [];
      try {
        const cartStr = localStorage.getItem('mercamesa_cart');
        if (cartStr) savedCart = JSON.parse(cartStr);
      } catch (e) {
        console.error('Error loading cart from localStorage:', e);
      }

      try {
        // getUser() verifica la sesión contra el servidor (no solo la cookie)
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error || !user) {
          // No hay sesión — marcamos como hidratado sin login pero cargando el carrito
          dispatch({ type: 'HYDRATE_GUEST', cart: savedCart });
          return;
        }

        // Tenemos usuario, busca su perfil para obtener role_id
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, avatar_url, role_id, roles(name)')
          .eq('id', user.id)
          .single();

        if (!profile) {
          dispatch({ type: 'HYDRATE_GUEST', cart: savedCart });
          return;
        }

        // Determina el RoleKey desde el nombre del rol en la BD
        const roleName = (profile.roles as any)?.name || 'retail';
        const roleKey: RoleKey = roleNameToKey[roleName] ?? 'retail';

        dispatch({
          type: 'HYDRATE',
          role: roleKey,
          profile: {
            id: user.id,
            email: user.email || '',
            name: profile.full_name || '',
            avatar: profile.avatar_url || '',
            role_id: profile.role_id,
          },
          cart: savedCart,
        });
      } catch (err) {
        console.error('Hydration error:', err);
        dispatch({ type: 'HYDRATE_GUEST', cart: savedCart });
      }
    };

    hydrate();

    // Escucha cambios de sesión (login/logout desde otra pestaña, token refresh, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        dispatch({ type: 'LOGOUT' });
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        hydrate();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Guardar en localStorage cada vez que el carrito cambia y la app está hidratada
  useEffect(() => {
    if (state._hydrated) {
      try {
        localStorage.setItem('mercamesa_cart', JSON.stringify(state.cart));
      } catch (e) {
        console.error('Error saving cart to localStorage:', e);
      }
    }
  }, [state.cart, state._hydrated]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}