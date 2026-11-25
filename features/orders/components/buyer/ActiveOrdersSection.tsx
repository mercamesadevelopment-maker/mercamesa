'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useActiveOrders } from '@/features/orders/active-orders-context';
import type { OrderDetail } from '@/app/orders/types/order.types';
import { ActiveOrderCard } from './ActiveOrderCard';
import { BuyerOrderDetailModal } from './BuyerOrderDetailModal';

/** Cuántos pedidos se muestran arriba de la página de inicio. Los demás, en «Mis órdenes». */
const MAX_VISIBLES = 2;

/**
 * Los pedidos en curso del comprador, arriba de la página de inicio: lo primero
 * que ve al entrar. Sin pedidos en curso no aparece nada.
 */
export function ActiveOrdersSection() {
  const { enabled, loaded, orders } = useActiveOrders();
  const [abierto, setAbierto] = useState<OrderDetail | null>(null);

  if (!enabled) return null;

  // Mientras carga se reserva el espacio de una tarjeta: si no, al llegar empuja
  // la página hacia abajo de golpe.
  if (!loaded) {
    return (
      <div className="mx-auto max-w-7xl px-4 pt-8 lg:px-8" aria-hidden>
        <div className="h-36 animate-pulse rounded-[28px] bg-mm-gbg motion-reduce:animate-none" />
      </div>
    );
  }
  if (orders.length === 0) return null;

  const visibles = orders.slice(0, MAX_VISIBLES);
  return (
    <section className="mx-auto max-w-7xl px-4 pt-8 lg:px-8" aria-label="Tus pedidos en curso">
      <div className={visibles.length > 1 ? 'grid gap-3 sm:gap-6 lg:grid-cols-2' : ''}>
        {visibles.map((item) => (
          <ActiveOrderCard key={item.order.order_code ?? item.order.order_id} item={item} onOpen={() => setAbierto(item.order)} />
        ))}
      </div>
      {orders.length > MAX_VISIBLES && (
        <Link href="/orders" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-tinta">
          Ver tus {orders.length} pedidos en curso <ChevronRight className="h-4 w-4" />
        </Link>
      )}
      <BuyerOrderDetailModal isOpen={!!abierto} onClose={() => setAbierto(null)} order={abierto} />
    </section>
  );
}
