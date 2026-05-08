export type RoleKey = 'retail' | 'wholesale' | 'provider' | 'delivery' | 'admin';

export interface Role {
  k: RoleKey;
  emoji: string;
  icon: string;
  color: string;
  bg: string;
  brd: string;
  title: string;
  sub: string;
  tagline: string;
  perks: string[];
}

export interface Plaza {
  id: number;
  emoji: string;
  name: string;
  city: string;
  address: string;
  stores: number;
  open: boolean;
  rating: number;
  bg: string;
  image?: string;
  tags: string[];
  status: 'active' | 'maintenance';
  openTime: string;
  closeTime: string;
  phone: string;
  location: { lat: number; lng: number };
  website?: string;
  email: string;
}

export interface StoreReview {
  id: string;
  storeId: number;
  buyerId: string;
  buyerName: string;
  stars: number;
  comment: string;
  date: string;
}

export interface Store {
  id: number;
  plazaId: number;
  emoji: string;
  name: string;
  image?: string;
  ownerName: string;
  cat: string;
  phone: string;
  desc: string;
  open: boolean;
  rating: number;
  reviewCount: number;
  local: string;
  status: 'active' | 'inactive';
  openTime: string;
  closeTime: string;
  location: { lat: number; lng: number };
  website?: string;
  email: string;
}

export interface MasterProduct {
  id: number;
  name: string;
  cat: string;
  emoji: string;
  image?: string;
  defaultUnit: string;
}

export interface Product {
  id: number;
  plazaId: number;
  storeId: number;
  emoji: string;
  image?: string;
  name: string;
  cat: string;
  unit: string;
  retailPrice: number;
  wsPrice: number;
  ws20: number;
  ws50: number;
  wsMin: number;
  stock: number;
  minStock: number;
  masterId?: number;
  desc: string;
  status: 'active' | 'inactive';
}

export interface CartItem extends Product {
  qty: number;
}

export interface OrderItem {
  id: number;
  name: string;
  qty: number;
  price: number;
  unit: string;
  emoji: string;
  image?: string;
}

export type SaleStatus = 'pedido' | 'preparado' | 'entregado' | 'pagado';

export interface Sale {
  id: number;
  date: string;
  storeId: number;
  items: OrderItem[];
  total: number;
  status: SaleStatus;
  customerName?: string;
  customerID?: string;
  customerEmail?: string;
}

export interface Order {
  id: string;
  date: string;
  storeId: number;
  storeName: string;
  storeEmoji: string;
  items: OrderItem[];
  total: number;
  status: 'pending' | 'preparing' | 'on_the_way' | 'delivered' | 'cancelled';
  buyerId: string;
  address: string;
  paymentMethod: string;
}

export interface Address {
  id: string;
  label: string;
  street: string;
  neighborhood: string;
  city: string;
  notes: string;
  isDefault: boolean;
  icon: string;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'cash' | 'nequi' | 'daviplata';
  label: string;
  brand?: string;
  last4?: string;
  exp?: string;
  isDefault: boolean;
}

export interface BuyerProfile {
  id: string;
  role_id?: string;
  name: string;
  phone: string;
  email: string;
  avatar: string;
  memberSince: string;
  rating: number;
  totalOrders: number;
  totalSpent: number;
  loyaltyPoints: number;
  addresses: Address[];
  payments: PaymentMethod[];
  storeRatings: Record<number, { stars: number; comment: string; date: string }>;
  favoriteStores: number[];
  prefs: {
    orderNotif: boolean;
    promoNotif: boolean;
    stockNotif: boolean;
    whatsappNotif: boolean;
  };
}

export interface AppNotification {
  id: string;
  type: 'order_new' | 'price_update' | 'rating' | 'payment';
  title: string;
  msg: string;
  time: string;
  read: boolean;
}

export interface Offer {
  id: number;
  storeId: number;
  plazaId: number;
  title: string;
  desc: string;
  type: 'percentage' | 'fixed';
  value: number; 
  productIds: number[]; 
  status: 'active' | 'expired';
  endDate: string;
  image?: string;
  emoji: string;
}
