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

  // En móvil, apiladas ocupaban ~330px antes del primer pedido. Van en dos
  // columnas: los dos conteos lado a lado, y el gasto —la cifra más larga— arriba
  // a todo el ancho para que el monto en pesos no se parta.
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-6 mb-6 sm:mb-10">
      <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-mm-crd shadow-sm">
        <p className="text-[10px] sm:text-xs text-mm-txw font-bold uppercase tracking-wider sm:tracking-widest mb-1 sm:mb-2">Total pedidos</p>
        <p className="text-2xl sm:text-3xl font-fraunces text-mm-g">{stats.totalOrders}</p>
      </div>
      <div className="col-span-2 order-first sm:col-span-1 sm:order-none bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-mm-crd shadow-sm">
        <p className="text-[10px] sm:text-xs text-mm-txw font-bold uppercase tracking-wider sm:tracking-widest mb-1 sm:mb-2">Gasto total</p>
        <p className="text-2xl sm:text-3xl font-fraunces text-mm-g whitespace-nowrap">
          {formatCurrency(stats.totalSpent)}
        </p>
      </div>
      <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-mm-crd shadow-sm">
        <p className="text-[10px] sm:text-xs text-mm-txw font-bold uppercase tracking-wider sm:tracking-widest mb-1 sm:mb-2">Esta semana</p>
        <p className="text-2xl sm:text-3xl font-fraunces text-mm-g">
          {stats.thisWeekOrders}
        </p>
      </div>
    </div>
  );
}
