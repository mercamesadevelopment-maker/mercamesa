import { Role, Plaza, Product, Store, BuyerProfile, MasterProduct, StoreReview, RoleKey } from './types';

export const C = {
  g: "#2A4E12", gm: "#3E7023", gl: "#6FA33E", gll: "#C8E6A0", gbg: "#F2F7EC",
  oro: "#D4920A", orl: "#FBF0D5",
  blue: "#1A5FA8", bluel: "#DCE9F8",
  r: "#CF3D2E", rl: "#FDECEA",
  ok: "#2A7D3E", okl: "#E3F4E8",
  warn: "#B87000", warnl: "#FDF3DC",
  cr: "#FAFAF5", crd: "#E8E8DC", bl: "#FFFFFF",
  tx: "#1A2610", txs: "#5C6B4A", txw: "#9AA88C",
};

export const fmt = (n: number) => "$" + Number(n || 0).toLocaleString("es-CO");

// A dónde redirigir a cada rol tras iniciar sesión (LoginModal.tsx, app/page.tsx)
export const ROLE_ROUTES: Record<RoleKey, string> = {
  retail: '/marketplaces',
  wholesale: '/marketplaces',
  provider: '/seller/dashboard',
  delivery: '/delivery',
  admin: '/admin/marketplaces',
};

export const ROLES: Role[] = [
  {
    k: "retail", emoji: "🛒", icon: "ShoppingBag", color: "#2A4210", bg: "#EAF4E0", brd: "#B8DFA8",
    title: "Comprador Minorista", sub: "Hogares y familias", tagline: "Fresco cada semana",
    perks: ["Delivery a domicilio", "Precios de plaza", "Historial de pedidos", "PlazaCoins"]
  },
  {
    k: "wholesale", emoji: "📦", icon: "TrendingUp", color: "#1A5499", bg: "#E6EFF9", brd: "#99BDE0",
    title: "Comprador Mayorista", sub: "Restaurantes y distribuidores", tagline: "Volumen con precio",
    perks: ["Precios mayoristas", "Facturas electrónicas", "Línea de crédito", "Asesor dedicado"]
  },
  {
    k: "provider", emoji: "🌱", icon: "Store", color: "#7A4200", bg: "#FDF0E2", brd: "#F0C490",
    title: "Local / Tienda", sub: "Locales y tenderos", tagline: "Tu tienda en línea",
    perks: ["Perfil de tienda", "Gestión de inventario", "Bot WhatsApp", "Analítica"]
  },
  {
    k: "delivery", emoji: "🚴", icon: "Truck", color: "#1A6B3A", bg: "#E2F5EA", brd: "#90D4AC",
    title: "Repartidor", sub: "Gana entregando pedidos", tagline: "Rutas, pagos, libertad",
    perks: ["Horario libre", "Pagos semanales", "Seguro de accidentes", "Bonos"]
  },
  {
    k: "admin", emoji: "⚙️", icon: "Settings", color: "#2A4E12", bg: "#F2F7EC", brd: "#C8E6A0",
    title: "Administrador", sub: "Gestión de la plataforma", tagline: "Control total",
    perks: ["Gestión global", "Reportes avanzados", "Control de usuarios", "Configuración"]
  },
];

export const SEED_PLAZAS: Plaza[] = [
  { 
    id: 1, emoji: "🏛️", image: "https://picsum.photos/seed/market1/800/600", name: "Plaza Minorista", city: "Medellín", address: "Carrera 57 #44-44", 
    stores: 24, open: true, rating: 4.8, bg: "#E8F5E9", tags: ["Verduras", "Frutas", "Carnes"], 
    status: "active", openTime: "04:00", closeTime: "18:00", phone: "604 2511010", 
    location: { lat: 6.2530, lng: -75.5750 }, website: "https://plazaminorista.com", email: "info@plazaminorista.com" 
  },
  { 
    id: 2, emoji: "🌿", image: "https://picsum.photos/seed/market2/800/600", name: "Central de Abastos", city: "Bogotá", address: "Av. 68 #16-85 Sur", 
    stores: 47, open: true, rating: 4.7, bg: "#FFF8E1", tags: ["Mayoreo", "Granos", "Especias"], 
    status: "active", openTime: "03:00", closeTime: "16:00", phone: "601 3500000", 
    location: { lat: 4.6243, lng: -74.1533 }, website: "https://corabastos.com", email: "atencion@corabastos.com" 
  },
  { 
    id: 3, emoji: "🌾", image: "https://picsum.photos/seed/market3/800/600", name: "Galería Alameda", city: "Cali", address: "Calle 8 #27-40", 
    stores: 31, open: false, rating: 4.6, bg: "#FBE9E7", tags: ["Lácteos", "Frutas", "Flores"], 
    status: "maintenance", openTime: "06:00", closeTime: "19:00", phone: "602 5551212", 
    location: { lat: 3.4380, lng: -76.5360 }, email: "contacto@alameda.com" 
  },
  { 
    id: 4, emoji: "🍀", image: "https://picsum.photos/seed/market4/800/600", name: "Mercado La 14", city: "Pereira", address: "Av. Las Américas #14-50", 
    stores: 18, open: true, rating: 4.5, bg: "#F3E5F5", tags: ["Verduras", "Carnes", "Pan"], 
    status: "active", openTime: "07:00", closeTime: "20:00", phone: "606 3334444", 
    location: { lat: 4.8133, lng: -75.6961 }, email: "la14pereira@mercado.com" 
  },
];

export const SEED_STORES: Store[] = [
  { 
    id: 1, plazaId: 1, emoji: "🍅", image: "https://picsum.photos/seed/tomatoes/400/300", name: "Tomates El Paisa", ownerName: "Carlos Gómez", 
    cat: "Frutas y verduras", phone: "+57 300 111 2222", desc: "Especialistas en tomate y verdura fresca.", 
    open: true, rating: 4.9, reviewCount: 124, local: "A-12", status: "active", 
    openTime: "05:00", closeTime: "17:00", location: { lat: 6.2531, lng: -75.5751 }, email: "carlos@tomateselpaisa.com" 
  },
  { 
    id: 2, plazaId: 1, emoji: "🥬", image: "https://picsum.photos/seed/vegetables/400/300", name: "Verduras Don Carlos", ownerName: "Carlos Restrepo", 
    cat: "Hortalizas", phone: "+57 310 234 5678", desc: "Hortalizas y aromáticas de primera calidad.", 
    open: true, rating: 4.8, reviewCount: 86, local: "B-04", status: "active", 
    openTime: "05:00", closeTime: "17:00", location: { lat: 6.2532, lng: -75.5752 }, email: "doncarlos@verduras.com" 
  },
  { 
    id: 3, plazaId: 1, emoji: "🧄", image: "https://picsum.photos/seed/spices/400/300", name: "Especias La Abuela", ownerName: "Rosa Martínez", 
    cat: "Especias y condimentos", phone: "+57 315 678 9012", desc: "30 años vendiendo las mejores especias.", 
    open: true, rating: 5.0, reviewCount: 42, local: "C-01", status: "active", 
    openTime: "06:00", closeTime: "18:00", location: { lat: 6.2533, lng: -75.5753 }, email: "abuela@especias.com" 
  },
  { 
    id: 4, plazaId: 1, emoji: "🥩", image: "https://picsum.photos/seed/meat/400/300", name: "Carnes El Corral", ownerName: "Jhon Pérez", 
    cat: "Carnes y embutidos", phone: "+57 300 987 6543", desc: "Carne de res y cerdo de la mejor calidad.", 
    open: false, rating: 4.6, reviewCount: 57, local: "D-08", status: "active", 
    openTime: "06:00", closeTime: "18:00", location: { lat: 6.2534, lng: -75.5754 }, email: "info@carneselcorral.com" 
  },
  { 
    id: 5, plazaId: 2, emoji: "🌽", image: "https://picsum.photos/seed/grains/400/300", name: "Granos del Valle", ownerName: "Pedro Vargas", 
    cat: "Granos y cereales", phone: "+57 318 111 3344", desc: "Granos nacionales e importados.", 
    open: true, rating: 4.7, reviewCount: 93, local: "A-01", status: "active", 
    openTime: "04:00", closeTime: "15:00", location: { lat: 4.6244, lng: -74.1534 }, email: "pedro@granosdelvalle.com" 
  },
  { 
    id: 6, plazaId: 2, emoji: "🧅", image: "https://picsum.photos/seed/sauce/400/300", name: "Condimentos Gourmet", ownerName: "Sandra López", 
    cat: "Especias premium", phone: "+57 312 556 7890", desc: "Especias y salsas artesanales.", 
    open: true, rating: 4.9, reviewCount: 31, local: "B-11", status: "active", 
    openTime: "04:00", closeTime: "15:00", location: { lat: 4.6245, lng: -74.1535 }, email: "sandra@gourmet.com" 
  },
];

export const SEED_REVIEWS: StoreReview[] = [
  { id: 'rev-1', storeId: 1, buyerId: 'u1', buyerName: 'María García', stars: 5, comment: 'Los mejores tomates de la plaza, siempre frescos.', date: '2024-04-10T10:00:00Z' },
  { id: 'rev-2', storeId: 1, buyerId: 'u2', buyerName: 'Jorge Negret', stars: 4, comment: 'Buena calidad, aunque hoy llegaron un poco maduros.', date: '2024-04-12T14:30:00Z' },
  { id: 'rev-3', storeId: 2, buyerId: 'u3', buyerName: 'Luisa Fernanda', stars: 5, comment: 'El cilantro huele espectacular, super recomendado.', date: '2024-04-15T09:15:00Z' },
  { id: 'rev-4', storeId: 3, buyerId: 'u1', buyerName: 'María García', stars: 5, comment: 'Especias únicas, no se consiguen en otro lado.', date: '2024-04-16T11:45:00Z' },
  { id: 'rev-5', storeId: 4, buyerId: 'u4', buyerName: 'Roberto Gómez', stars: 3, comment: 'La carne estaba bien, pero el pedido tardó mucho.', date: '2024-04-17T08:00:00Z' },
];

export const SEED_PRODUCTS: Product[] = [
  { id: 1, plazaId: 1, storeId: 1, emoji: "🍅", image: "https://picsum.photos/seed/tomato-product/400/400", name: "Tomate Chonto", cat: "Verduras", unit: "kg", retailPrice: 2500, wsPrice: 2000, ws20: 1800, ws50: 1600, wsMin: 10, stock: 85, minStock: 20, desc: "Primera calidad, cosechado hoy.", status: "active" },
  { id: 2, plazaId: 1, storeId: 1, emoji: "🍋", image: "https://picsum.photos/seed/lemon/400/400", name: "Limón Tahití", cat: "Frutas", unit: "kg", retailPrice: 3200, wsPrice: 2700, ws20: 2500, ws50: 2200, wsMin: 15, stock: 42, minStock: 15, desc: "Jugoso y fresco.", status: "active" },
  { id: 3, plazaId: 1, storeId: 2, emoji: "🥬", image: "https://picsum.photos/seed/cilantro/400/400", name: "Cilantro Manojo", cat: "Verduras", unit: "manojo", retailPrice: 1200, wsPrice: 900, ws20: 800, ws50: 700, wsMin: 20, stock: 60, minStock: 25, desc: "Aromático, cortado esta mañana.", status: "active" },
  { id: 4, plazaId: 1, storeId: 2, emoji: "🥕", image: "https://picsum.photos/seed/carrot/400/400", name: "Zanahoria Premium", cat: "Verduras", unit: "kg", retailPrice: 1800, wsPrice: 1400, ws20: 1200, ws50: 1000, wsMin: 20, stock: 0, minStock: 30, desc: "Zanahoria nacional.", status: "active" },
  { id: 5, plazaId: 2, storeId: 5, emoji: "🌽", image: "https://picsum.photos/seed/corn/400/400", name: "Maíz Blanco", cat: "Granos", unit: "bulto", retailPrice: 85000, wsPrice: 72000, ws20: 65000, ws50: 58000, wsMin: 3, stock: 40, minStock: 5, desc: "Bultos 50kg seleccionados.", status: "active" },
  { id: 6, plazaId: 2, storeId: 6, emoji: "🌶️", image: "https://picsum.photos/seed/pepper/400/400", name: "Ají Dulce", cat: "Especias", unit: "kg", retailPrice: 4500, wsPrice: 3800, ws20: 3400, ws50: 3000, wsMin: 10, stock: 35, minStock: 10, desc: "Ají dulce colombiano.", status: "active" },
  { id: 7, plazaId: 1, storeId: 2, emoji: "🧅", image: "https://picsum.photos/seed/onion/400/400", name: "Cebolla Cabezona", cat: "Verduras", unit: "kg", retailPrice: 2200, wsPrice: 1800, ws20: 1600, ws50: 1400, wsMin: 10, stock: 120, minStock: 20, desc: "Blanca, fresca.", status: "active" },
  { id: 8, plazaId: 1, storeId: 3, emoji: "🧄", image: "https://picsum.photos/seed/garlic/400/400", name: "Ajo Nacional", cat: "Especias", unit: "cabeza", retailPrice: 800, wsPrice: 600, ws20: 550, ws50: 500, wsMin: 50, stock: 200, minStock: 30, desc: "Seleccionado, ideal cocina profesional.", status: "active" },
];

export const DEFAULT_BUYER_PROFILE: BuyerProfile = {
  id: "buyer-default",
  name: "María García",
  phone: "+57 300 123 4567",
  email: "maria.garcia@gmail.com",
  avatar: "https://picsum.photos/seed/maria/200/200",
  memberSince: "Enero 2024",
  rating: 4.9,
  totalOrders: 23,
  totalSpent: 1240000,
  loyaltyPoints: 1860,
  addresses: [
    { id: "a1", label: "Casa", street: "Cra 70 #45-12", neighborhood: "Laureles", city: "Medellín", notes: "Apto 302, timbre azul", isDefault: true, icon: "🏠" },
    { id: "a2", label: "Trabajo", street: "Cl 10 #43-01", neighborhood: "El Centro", city: "Medellín", notes: "Piso 4, preguntar por María", isDefault: false, icon: "🏢" },
  ],
  payments: [],
  storeRatings: { 1: { stars: 5, comment: "Excelente calidad", date: "2024-03-15" } },
  favoriteStores: [1, 3, 6],
  prefs: { orderNotif: true, promoNotif: false, stockNotif: true, whatsappNotif: true },
};

export const WEEK_DATA = [
  { day: "Lun", v: 186000, o: 8 }, { day: "Mar", v: 243000, o: 11 }, { day: "Mié", v: 198000, o: 9 },
  { day: "Jue", v: 312000, o: 14 }, { day: "Vie", v: 428000, o: 19 }, { day: "Sáb", v: 387000, o: 17 }, { day: "Hoy", v: 215000, o: 10 }
];

export const CAT_DATA = [
  { name: "Verduras", v: 38, color: "#3E7023", image: "https://images.unsplash.com/photo-1566385101042-1a000c1268c4?auto=format&fit=crop&q=80&w=400" },
  { name: "Frutas", v: 24, color: "#F59E0B", image: "https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&q=80&w=400" },
  { name: "Especias", v: 15, color: "#CF3D2E", image: "https://images.unsplash.com/photo-1532336414038-cf19250c5757?auto=format&fit=crop&q=80&w=400" },
  { name: "Granos", v: 13, color: "#8B5CF6", image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=400" },
  { name: "Carnes", v: 6, color: "#EC4899", image: "https://images.unsplash.com/photo-1432139555190-58524dae6a55?auto=format&fit=crop&q=80&w=400" },
  { name: "Lácteos", v: 4, color: "#06B6D4", image: "https://images.unsplash.com/photo-1550583724-125581cc255b?auto=format&fit=crop&q=80&w=400" },
];

export const SEED_CATALOG: MasterProduct[] = [
  { id: 1, name: "Tomate Chonto", cat: "Verduras", emoji: "🍅", image: "https://picsum.photos/seed/tomato-product/400/400", defaultUnit: "kg" },
  { id: 2, name: "Limón Tahití", cat: "Frutas", emoji: "🍋", image: "https://picsum.photos/seed/lemon/400/400", defaultUnit: "kg" },
  { id: 3, name: "Cilantro", cat: "Verduras", emoji: "🥬", image: "https://picsum.photos/seed/cilantro/400/400", defaultUnit: "manojo" },
  { id: 4, name: "Zanahoria", cat: "Verduras", emoji: "🥕", image: "https://picsum.photos/seed/carrot/400/400", defaultUnit: "kg" },
  { id: 5, name: "Maíz Blanco", cat: "Granos", emoji: "🌽", image: "https://picsum.photos/seed/corn/400/400", defaultUnit: "bulto" },
  { id: 6, name: "Ají Dulce", cat: "Especias", emoji: "🌶️", image: "https://picsum.photos/seed/pepper/400/400", defaultUnit: "kg" },
  { id: 7, name: "Cebolla Cabezona", cat: "Verduras", emoji: "🧅", image: "https://picsum.photos/seed/onion/400/400", defaultUnit: "kg" },
  { id: 8, name: "Ajo Nacional", cat: "Especias", emoji: "🧄", image: "https://picsum.photos/seed/garlic/400/400", defaultUnit: "cabeza" },
  { id: 9, name: "Papas Sabanera", cat: "Verduras", emoji: "🥔", image: "https://picsum.photos/seed/potato/400/400", defaultUnit: "kg" },
  { id: 10, name: "Arroz Integral", cat: "Granos", emoji: "🍚", image: "https://picsum.photos/seed/rice/400/400", defaultUnit: "kg" },
];
