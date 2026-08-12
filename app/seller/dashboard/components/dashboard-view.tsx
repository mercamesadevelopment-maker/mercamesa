'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  History,
  Leaf,
  Package,
  ShoppingCart,
  Star,
  TrendingUp,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button, Badge, cn } from '@/src/components/Shared';
import { fmt } from '@/src/constants';
import { ORDER_STATUS_LABELS, type OrderStatus } from '@/app/orders/types/order.types';
import { useSellerDashboard, type Trend } from '../hooks/use-seller-dashboard';

const LOCAL_COLOR = '#3E7023';
const DIGITAL_COLOR = '#D4AF37';

const CHART_TOOLTIP_STYLE = {
  borderRadius: '24px',
  border: '1px solid #E8E8DC',
  boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.05)',
  padding: '12px 20px',
};

export function DashboardView() {
  const router = useRouter();
  const {
    stores,
    storeId,
    storeName,
    selectStore,
    sellerName,
    loading,
    error,
    metrics,
    revenueSeries,
    recentActivity,
    lowestStockProducts,
    outOfStockCount,
    activeProductCount,
    reputation,
    hasSales,
  } = useSellerDashboard();

  const channelData = [
    { name: 'Ventas en local', value: metrics.localRevenue, fill: LOCAL_COLOR },
    { name: 'Pedidos digitales', value: metrics.digitalRevenue, fill: DIGITAL_COLOR },
  ];
  const channelTotal = metrics.localRevenue + metrics.digitalRevenue;

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-12 bg-mm-gbg/10 min-h-screen">
      {/* Encabezado */}
      <div className="relative overflow-hidden bg-mm-g rounded-[48px] p-8 lg:p-12 text-white shadow-2xl shadow-mm-g/20">
        <div className="absolute top-0 right-0 w-64 h-64 bg-mm-oro opacity-10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-white opacity-5 rounded-full translate-y-1/2 -translate-x-1/3 blur-3xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              {stores.length > 1 ? (
                <select
                  value={storeId || ''}
                  onChange={(e) => selectStore(e.target.value)}
                  className="bg-white/10 border border-white/20 rounded-2xl px-4 py-2 text-sm font-bold text-white outline-none cursor-pointer backdrop-blur-xl"
                >
                  {stores.map((store) => (
                    <option key={store.id} value={store.id} className="text-mm-g">
                      {store.name}
                    </option>
                  ))}
                </select>
              ) : (
                <Badge variant="oro" className="px-4 py-1">
                  {storeName || 'Mi tienda'}
                </Badge>
              )}
            </div>
            <h1 className="text-5xl lg:text-6xl font-fraunces mb-4 leading-tight">
              ¡Buen día{sellerName ? `, ${sellerName}` : ''}! 🥕
            </h1>
            <p className="text-mm-gll text-lg max-w-md leading-relaxed opacity-90">
              {metrics.todayRevenue > 0 ? (
                <>
                  Hoy llevas <span className="font-bold text-white">{fmt(metrics.todayRevenue)}</span>{' '}
                  en {metrics.todayOrderCount} {metrics.todayOrderCount === 1 ? 'venta' : 'ventas'}
                  {metrics.todayTrend && (
                    <>
                      , un <span className="font-bold text-white">{metrics.todayTrend.percent}%</span>{' '}
                      {metrics.todayTrend.isUp ? 'más' : 'menos'} que ayer
                    </>
                  )}
                  .
                </>
              ) : (
                'Todavía no registras ventas hoy.'
              )}
            </p>
            <div className="flex flex-wrap gap-4 mt-10">
              <Button
                size="lg"
                className="rounded-[24px] px-8 h-14 text-lg bg-white text-mm-g hover:bg-mm-gbg shadow-xl shadow-black/10 transition-all active:scale-95 group"
                onClick={() => router.push('/seller/sales')}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-mm-g/10 flex items-center justify-center group-hover:rotate-12 transition-transform">
                    <ShoppingCart className="w-4 h-4 text-mm-g" />
                  </div>
                  <span>Venta rápida en local</span>
                </div>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-[24px] px-8 h-14 text-lg border-white/30 text-white hover:bg-white/10 transition-all shadow-lg active:scale-95"
                onClick={() => router.push('/seller/orders')}
              >
                Monitor de pedidos
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 backdrop-blur-xl p-6 rounded-3xl border border-white/20">
              <p className="text-[10px] font-black tracking-widest uppercase text-mm-gll mb-1">
                Ventas en local
              </p>
              <p className="text-2xl font-bold">{fmt(metrics.localRevenue)}</p>
            </div>
            <div className="bg-mm-oro/20 backdrop-blur-xl p-6 rounded-3xl border border-mm-oro/30">
              <p className="text-[10px] font-black tracking-widest uppercase text-mm-gll mb-1">
                Pedidos digitales
              </p>
              <p className="text-2xl font-bold">{fmt(metrics.digitalRevenue)}</p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rl text-r text-sm font-medium px-6 py-4 rounded-3xl">{error}</div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard
          icon={<TrendingUp className="w-6 h-6" />}
          iconClass="bg-okl text-ok"
          label="Ingresos de hoy"
          value={fmt(metrics.todayRevenue)}
          trend={metrics.todayTrend}
          trendLabel="vs. ayer"
          loading={loading}
        />
        <KpiCard
          icon={<Activity className="w-6 h-6" />}
          iconClass="bg-mm-orl text-mm-oro"
          label="Ingresos del mes"
          value={fmt(metrics.monthRevenue)}
          trend={metrics.monthTrend}
          trendLabel="vs. mes pasado"
          loading={loading}
        />
        <KpiCard
          icon={<Package className="w-6 h-6" />}
          iconClass="bg-bluel text-blue"
          label="Pedidos por atender"
          value={String(metrics.pendingOrders)}
          footer={
            <button
              className="text-[10px] text-blue font-bold hover:underline"
              onClick={() => router.push('/seller/orders')}
            >
              Ver pedidos
            </button>
          }
          loading={loading}
        />
        <KpiCard
          icon={<Leaf className="w-6 h-6" />}
          iconClass="bg-mm-gbg text-mm-g"
          label="Productos agotados"
          value={String(outOfStockCount)}
          valueClass={outOfStockCount > 0 ? 'text-r' : 'text-mm-g'}
          aside={<span className="text-[10px] font-bold text-mm-txw">{activeProductCount} activos</span>}
          loading={loading}
        />
      </div>

      {/* Ingresos por día */}
      <div className="bg-white p-8 lg:p-10 rounded-[48px] border border-mm-crd shadow-sm">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h3 className="text-2xl font-fraunces text-mm-g">Ingresos por día</h3>
            <p className="text-sm text-mm-txs">Últimos 30 días, sin contar pedidos cancelados</p>
          </div>
        </div>
        <div className="h-72 w-full">
          {hasSales ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueSeries} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="sellerRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={LOCAL_COLOR} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={LOCAL_COLOR} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#9AA88C' }}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#9AA88C' }}
                  tickFormatter={(value: number) => (value >= 1000 ? `$${value / 1000}k` : `$${value}`)}
                  width={56}
                />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  formatter={(value: number) => [fmt(value), 'Ingresos']}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke={LOCAL_COLOR}
                  strokeWidth={2.5}
                  fill="url(#sellerRevenue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              icon={<Activity className="w-12 h-12" />}
              title="Aún no tienes ventas registradas"
              subtitle="Cuando registres tu primera venta, acá verás cómo evoluciona día a día."
            />
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Comparativo por canal */}
        <div className="lg:col-span-2 bg-white p-10 rounded-[48px] border border-mm-crd shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-10 flex-wrap gap-4">
            <div>
              <h3 className="text-2xl font-fraunces text-mm-g">Comparativo por canal</h3>
              <p className="text-sm text-mm-txs">Ventas en local frente a pedidos digitales</p>
            </div>
            <div className="flex items-center gap-4 bg-mm-gbg/50 px-4 py-2 rounded-2xl">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: LOCAL_COLOR }} />
                <span className="text-[10px] font-bold text-mm-g uppercase">Local</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: DIGITAL_COLOR }} />
                <span className="text-[10px] font-bold text-mm-g uppercase">Digital</span>
              </div>
            </div>
          </div>
          <div className="h-80 w-full relative">
            {channelTotal > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={channelData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={120}
                      paddingAngle={8}
                      dataKey="value"
                    >
                      {channelData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      itemStyle={{ fontWeight: 'bold' }}
                      formatter={(value: number) => [fmt(value), 'Ingresos']}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                  <p className="text-[10px] font-black text-mm-txw uppercase tracking-widest leading-none">
                    Total del periodo
                  </p>
                  <p className="text-2xl font-bold text-mm-g mt-1">{fmt(channelTotal)}</p>
                </div>
              </>
            ) : (
              <EmptyState
                icon={<ShoppingCart className="w-12 h-12" />}
                title="Sin ventas en el periodo"
                subtitle="Acá se compara cuánto vendes en el local contra lo que vendes por la app."
              />
            )}
          </div>
        </div>

        {/* Actividad reciente */}
        <div className="bg-white p-10 rounded-[48px] border border-mm-crd shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-fraunces text-mm-g">Actividad reciente</h3>
            <History className="w-5 h-5 text-mm-txw" />
          </div>
          <div className="flex-grow space-y-6 overflow-y-auto pr-2 scrollbar-hide">
            {recentActivity.map((activity) => (
              <div key={activity.storeOrderId} className="flex gap-4">
                <div
                  className={cn(
                    'w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border border-white shadow-sm',
                    activity.isLocal ? 'bg-mm-gbg text-mm-g' : 'bg-bluel text-blue'
                  )}
                >
                  {activity.isLocal ? (
                    <ShoppingCart className="w-5 h-5" />
                  ) : (
                    <Package className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-grow overflow-hidden border-b border-mm-crd/50 pb-4 last:border-0">
                  <div className="flex justify-between items-start gap-2">
                    <p className="text-sm font-bold text-mm-g truncate">
                      {activity.isLocal ? 'Venta en local' : 'Pedido digital'}
                      {activity.consecutive ? ` #${activity.consecutive}` : ''}
                    </p>
                    <span className="text-[9px] font-bold text-mm-txw shrink-0">
                      {new Date(activity.createdAt).toLocaleDateString('es-CO', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-mm-txs mt-0.5 truncate">{activity.customerName}</p>
                  <div className="flex items-center justify-between gap-2 mt-2">
                    <p className="text-sm font-bold text-mm-g">{fmt(activity.subtotal)}</p>
                    <Badge
                      variant={statusVariant(activity.status as OrderStatus)}
                      className="text-[9px]"
                    >
                      {ORDER_STATUS_LABELS[activity.status as OrderStatus] ?? activity.status}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
            {!loading && recentActivity.length === 0 && (
              <EmptyState
                icon={<History className="w-12 h-12" />}
                title="Sin actividad reciente"
                subtitle="Las ventas y pedidos del último mes aparecerán acá."
              />
            )}
          </div>
          <Button
            variant="outline"
            className="w-full mt-6 rounded-2xl"
            onClick={() => router.push('/seller/orders')}
          >
            Ver todos los pedidos
          </Button>
        </div>
      </div>

      {/* Menor stock */}
      <div className="bg-white p-10 rounded-[48px] border border-mm-crd shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-fraunces text-mm-g">Menor stock</h3>
          {outOfStockCount > 0 ? (
            <AlertCircle className="w-5 h-5 text-r" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-ok" />
          )}
        </div>
        <p className="text-sm text-mm-txs mb-8">
          Los productos con menos existencias en tu inventario.
        </p>
        {lowestStockProducts.length === 0 ? (
          <div className="text-center py-10 opacity-40">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-ok" />
            <p className="text-sm font-bold text-mm-g">Aún no tienes productos publicados</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lowestStockProducts.map((product) => {
              const isOut = product.stock <= 0;
              return (
                <button
                  key={product.id}
                  onClick={() => router.push('/seller/products')}
                  className={cn(
                    'flex items-center gap-4 p-4 rounded-3xl border group transition-colors text-left',
                    isOut
                      ? 'bg-rl/10 border-r/10 hover:bg-rl/20'
                      : 'bg-mm-gbg/20 border-mm-crd hover:bg-mm-gbg/40'
                  )}
                >
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center overflow-hidden border border-mm-crd shrink-0 text-xl">
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      '📦'
                    )}
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="text-sm font-bold text-mm-g truncate">{product.name}</p>
                    <p className={cn('text-xs font-bold', isOut ? 'text-r' : 'text-mm-txs')}>
                      {isOut ? 'Agotado' : `${product.stock} ${product.unit} restantes`}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-mm-txw group-hover:translate-x-1 transition-transform shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Reputación */}
      <div className="bg-white p-10 rounded-[48px] border border-mm-crd shadow-sm flex items-center gap-6 flex-wrap">
        <div className="w-14 h-14 bg-mm-orl rounded-2xl flex items-center justify-center text-mm-oro shrink-0">
          <Star className="w-7 h-7" />
        </div>
        <div className="flex-grow">
          <p className="text-[10px] font-black text-mm-txw uppercase tracking-widest mb-1">
            Reputación de la tienda
          </p>
          {reputation.reviewCount > 0 ? (
            <p className="text-2xl font-bold text-mm-g">
              {reputation.score.toFixed(1)}{' '}
              <span className="text-sm font-medium text-mm-txs">
                de 5 · {reputation.reviewCount}{' '}
                {reputation.reviewCount === 1 ? 'calificación' : 'calificaciones'}
              </span>
            </p>
          ) : (
            <p className="text-lg font-bold text-mm-txs">Sin calificaciones aún</p>
          )}
        </div>
        <Button variant="outline" onClick={() => router.push('/seller/settings')}>
          Ver detalle
        </Button>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  iconClass,
  label,
  value,
  valueClass,
  trend,
  trendLabel,
  aside,
  footer,
  loading,
}: {
  icon: React.ReactNode;
  iconClass: string;
  label: string;
  value: string;
  valueClass?: string;
  trend?: Trend;
  trendLabel?: string;
  aside?: React.ReactNode;
  footer?: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="bg-white p-7 rounded-[32px] border border-mm-crd shadow-sm flex flex-col justify-between"
    >
      <div className="flex justify-between items-start mb-4">
        <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center', iconClass)}>
          {icon}
        </div>
        {/* El comparativo se omite cuando no hay periodo anterior con qué comparar. */}
        {trend && (
          <Badge variant={trend.isUp ? 'success' : 'error'} className="text-[9px] flex items-center gap-0.5">
            {trend.isUp ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : (
              <ArrowDownRight className="w-3 h-3" />
            )}
            {trend.percent}%
          </Badge>
        )}
        {aside}
      </div>
      <div>
        <p className="text-[10px] font-black text-mm-txw uppercase tracking-widest mb-1">{label}</p>
        <p className={cn('text-3xl font-bold tracking-tighter', valueClass || 'text-mm-g')}>
          {loading ? '—' : value}
        </p>
        {trend && trendLabel && (
          <p className="text-[10px] text-mm-txw mt-2">{trendLabel}</p>
        )}
        {footer && <div className="mt-2">{footer}</div>}
      </div>
    </motion.div>
  );
}

function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6">
      <div className="text-mm-txw opacity-40 mb-3">{icon}</div>
      <p className="text-sm font-bold text-mm-g">{title}</p>
      <p className="text-xs text-mm-txw mt-1 max-w-xs">{subtitle}</p>
    </div>
  );
}

function statusVariant(status: OrderStatus): 'success' | 'warning' | 'error' | 'info' | 'default' {
  switch (status) {
    case 'delivered':
      return 'success';
    case 'cancelled':
    case 'returned':
      return 'error';
    case 'pending':
      return 'warning';
    case 'dispatched':
    case 'at_collection':
      return 'info';
    default:
      return 'default';
  }
}
