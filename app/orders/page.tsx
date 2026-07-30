'use client';

import { useEffect, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { useOrders } from './hooks/useOrders';
import { useApp } from '@/src/store';
import { OrderStats } from './components/OrderStats';
import { OrderFilters } from './components/OrderFilters';
import { OrderCard } from './components/OrderCard';
import { Pagination } from './components/Pagination';
import { RatingModal } from '@/src/features/stores/components/RatingModal';
import { useStoreReviews } from '@/src/features/stores/hooks/use-store-reviews';
import { OrderStatus } from './types/order.types';

export default function OrdersPage() {
  const { state, dispatch } = useApp();
  const [page, setPage] = useState(1);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [status, setStatus] = useState<OrderStatus | null>(null);

  const { orders, meta, loading, error, stats } = useOrders({
    page,
    limit: 5,
    storeId,
    status,
  });

  const [ratingStoreId, setRatingStoreId] = useState<string | null>(null);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const { submitReview } = useStoreReviews();

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [storeId, status]);

  const handleOpenRating = (storeId: string) => {
    setRatingStoreId(storeId);
    setIsRatingModalOpen(true);
  };

  const handleClearFilters = () => {
    setStoreId(null);
    setStatus(null);
  };

  if (error) {
    return <div className="p-10 text-center text-r">Error: {error}</div>;
  }

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-fraunces text-mm-g mb-2">Mis Pedidos</h1>
          <p className="text-mm-txs">Sigue el estado de tus compras en tiempo real.</p>
        </div>
      </div>

      <OrderStats stats={stats} />

      <OrderFilters 
        selectedStoreId={storeId}
        onStoreChange={setStoreId}
        selectedStatus={status}
        onStatusChange={setStatus}
        onClear={handleClearFilters}
      />

      <div className="space-y-6 min-h-[400px] relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10 rounded-[32px]">
            <p className="text-mm-txs font-bold animate-pulse">Cargando...</p>
          </div>
        ) : null}

        {orders.length === 0 && !loading ? (
          <div className="bg-white p-12 rounded-[32px] border border-mm-crd text-center opacity-40 flex flex-col items-center">
            <ClipboardList className="w-20 h-20 text-mm-txw mb-4" />
            <p className="text-xl font-fraunces">
              No se encontraron pedidos con los filtros seleccionados
            </p>
          </div>
        ) : (
          orders.map(order => (
            <OrderCard 
              key={order.order_id} 
              order={order} 
              onRate={handleOpenRating}
            />
          ))
        )}
      </div>

      {meta && (
        <Pagination 
          currentPage={page}
          totalPages={meta.totalPages}
          onPageChange={setPage}
        />
      )}

      <RatingModal 
        isOpen={isRatingModalOpen}
        storeId={ratingStoreId}
        storeName={orders.find(o => o.store_id === ratingStoreId)?.store_name || undefined}
        onClose={() => setIsRatingModalOpen(false)}
        onSave={(data) => {
          if (ratingStoreId) submitReview(ratingStoreId, data);
        }}
      />
    </div>
  );
}
