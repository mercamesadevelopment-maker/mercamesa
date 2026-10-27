'use client';
import React, { createContext, useContext, useReducer, ReactNode, useEffect } from 'react';
import { createSupabaseBrowserClient } from '../lib/supabase/client'; // ajusta la ruta a tu cliente browser
import { fetchCart, recoverAbandonedCartDb } from './features/cart/services/cart.service';
import { CartItem, AppNotification, BuyerProfile, Product, RoleKey } from './types';
import { resolveRoleKey } from '@/lib/auth/roles';

interface AppState {
  cart: CartItem[];
  notifs: AppNotification[];
  buyerProfile: BuyerProfile;
  userRole: RoleKey;
  isLoggedIn: boolean;
  currentSection: string;
  // Flag para saber si ya intentamos hidratar desde Supabase
  _hydrated: boolean;
  // Aviso al intentar juntar en el carrito tiendas que no despachan desde el mismo punto
  cartStoreConflict: { currentStoreName: string } | null;
}

type AppAction =
  | { type: 'LOGIN'; role: RoleKey; profile?: Partial<BuyerProfile> }
  | { type: 'LOGOUT' }
  | { type: 'HYDRATE'; role: RoleKey; profile: Partial<BuyerProfile>; cart?: CartItem[] }
  | { type: 'SET_SECTION'; section: string }
  | { type: 'ADD_TO_CART'; product: Product; qty?: number }
  | { type: 'REMOVE_FROM_CART'; productId: number | string }
  | { type: 'UPDATE_CART_QTY'; productId: number | string; qty: number }
  | { type: 'UPDATE_CART_ITEM_NOTES'; productId: number | string; notes: string }
  | { type: 'CLEAR_CART' }
  | { type: 'HYDRATE_CART'; cart: CartItem[] }
  | { type: 'ADD_NOTIF'; notif: AppNotification }
  | { type: 'SET_NOTIFS'; notifs: AppNotification[] }
  | { type: 'READ_NOTIF'; notifId: string }
  | { type: 'READ_ALL_NOTIFS' }
  | { type: 'UPDATE_BUYER_PROFILE'; profile: Partial<BuyerProfile> }
  | { type: 'SET_CART_STORE_CONFLICT'; currentStoreName: string }
  | { type: 'CLEAR_CART_STORE_CONFLICT' };

const EMPTY_PROFILE: BuyerProfile = { id: '', name: '', email: '', avatar: '' };

const initialState: AppState = {
  cart: [],
  notifs: [],
  buyerProfile: EMPTY_PROFILE,
  userRole: 'retail',
  isLoggedIn: false,
  currentSection: 'home',
  _hydrated: false,
  cartStoreConflict: null,
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

    case 'LOGIN':
      return { 
        ...state, 
        isLoggedIn: true, 
        userRole: action.role, 
        currentSection: 'home',
        buyerProfile: action.profile ? { ...state.buyerProfile, ...action.profile } : state.buyerProfile,
        _hydrated: true,
      };

    case 'LOGOUT':
      return { 
        ...state, 
        isLoggedIn: false, 
        cart: [], 
        currentSection: 'home',
        buyerProfile: EMPTY_PROFILE,
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

    case 'UPDATE_CART_ITEM_NOTES':
      return {
        ...state,
        cart: state.cart.map(i => i.id === action.productId ? { ...i, notes: action.notes } : i)
      };

    case 'CLEAR_CART':
      return { ...state, cart: [] };

    case 'HYDRATE_CART':
      return { ...state, cart: action.cart };

    case 'ADD_NOTIF':
      return { ...state, notifs: [action.notif, ...state.notifs] };

    case 'SET_NOTIFS':
      return { ...state, notifs: action.notifs };

    case 'READ_NOTIF':
      return {
        ...state,
        notifs: state.notifs.map(n => n.id === action.notifId ? { ...n, read: true } : n)
      };

    case 'READ_ALL_NOTIFS':
      return { ...state, notifs: state.notifs.map(n => ({ ...n, read: true })) };

    case 'UPDATE_BUYER_PROFILE':
      return { ...state, buyerProfile: { ...state.buyerProfile, ...action.profile } };

    case 'SET_CART_STORE_CONFLICT':
      return { ...state, cartStoreConflict: { currentStoreName: action.currentStoreName } };

    case 'CLEAR_CART_STORE_CONFLICT':
      return { ...state, cartStoreConflict: null };

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
      try {
        // getUser() verifica la sesión contra el servidor (no solo la cookie)
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error || !user) {
          // No hay sesión — marcamos como hidratado sin login
          dispatch({ type: 'LOGOUT' });
          return;
        }

        // Tenemos usuario, busca su perfil para obtener role_id
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, avatar_url, role_id, buyer_type, roles(name)')
          .eq('id', user.id)
          .single();

        if (!profile) {
          dispatch({ type: 'LOGOUT' });
          return;
        }

        // Determina el RoleKey desde el nombre del rol en la BD (+ buyer_type si es comprador)
        const roleName = (profile.roles as any)?.name;
        const roleKey: RoleKey = resolveRoleKey(roleName, profile.buyer_type);

        // Cargar el carrito de la base de datos
        let dbCart: CartItem[] = [];
        try {
          // La página de estado de pago resuelve ella misma los ítems de su
          // orden; hacerlo también acá los revertiría justo antes de que ella
          // los borre.
          const isPaymentStatusPage =
            typeof window !== 'undefined' &&
            window.location.pathname.includes('/orders/payment-status');

          if (!isPaymentStatusPage) {
            try {
              // Rescata los ítems que quedaron en `pending` porque el comprador
              // abandonó el pago. No depende de sessionStorage, así que funciona
              // aunque haya vuelto desde otra pestaña o al día siguiente.
              await recoverAbandonedCartDb(user.id);
            } catch (e) {
              console.error('Error recuperando el carrito abandonado:', e);
            }
          }

          dbCart = await fetchCart(user.id);
        } catch (e) {
          console.error('Error loading cart from DB during hydration:', e);
        }

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
          cart: dbCart,
        });
      } catch (err) {
        console.error('Hydration error:', err);
        dispatch({ type: 'LOGOUT' });
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

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        window.location.reload();
      }
    };
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []);

  // La persistencia se maneja en base de datos.

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