import React from 'react';
import { OrderStats as IOrderStats } from '../types/order.types';

interface OrderStatsProps {
  stats: IOrderStats;
}

export function OrderStats({ stats }: OrderStatsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="grid sm:grid-cols-3 gap-6 mb-10">
      <div className="bg-white p-6 rounded-3xl border border-mm-crd shadow-sm">
        <p className="text-xs text-mm-txw font-bold uppercase tracking-widest mb-2">Total pedidos</p>
        <p className="text-3xl font-fraunces text-mm-g">{stats.totalOrders}</p>
      </div>
      <div className="bg-white p-6 rounded-3xl border border-mm-crd shadow-sm">
        <p className="text-xs text-mm-txw font-bold uppercase tracking-widest mb-2">Gasto total</p>
        <p className="text-3xl font-fraunces text-mm-g">
          {formatCurrency(stats.totalSpent)}
        </p>
      </div>
      <div className="bg-white p-6 rounded-3xl border border-mm-crd shadow-sm">
        <p className="text-xs text-mm-txw font-bold uppercase tracking-widest mb-2">Esta semana</p>
        <p className="text-3xl font-fraunces text-mm-g">
          {stats.thisWeekOrders}
        </p>
      </div>
    </div>
  );
}
