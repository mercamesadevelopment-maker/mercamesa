'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus, Tag, Trash2, Edit2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useOffers } from '@/src/features/offers/hooks/use-offers';
import { StoreOffer } from '@/src/features/offers/types/offer.types';
import { OfferModal } from '@/src/features/offers/components/OfferModal';
import { Button, Badge } from '@/src/components/Shared';

export default function OffersAdmin() {
  return (
    <Suspense fallback={null}>
      <OffersAdminContent />
    </Suspense>
  );
}

function OffersAdminContent() {
  const { offers, loading, error, fetchOffers, deleteOffer, saveOffer } = useOffers();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<StoreOffer | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  // Pagination state
  const [page, setPage] = useState(1);
  const rowsPerPage = 12; // Show more items per page for cards

  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  // Deep link desde la notificación de "oferta pendiente": abre el modal
  // de esa oferta específica una vez que la lista terminó de cargar.
  useEffect(() => {
    const offerId = searchParams.get('offerId');
    if (!offerId || loading) return;

    const target = offers.find((o) => o.id === offerId);
    if (target) {
      setEditingOffer(target);
      setIsModalOpen(true);
      router.replace('/admin/offers');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, loading, offers]);

  // Calculate pagination
  const totalPages = Math.ceil(offers.length / rowsPerPage);
  const paginatedData = offers.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const fmt = (price: number) => `$${price.toLocaleString('es-CO')}`;

  if (loading) return <div className="p-8 text-center text-mm-txs">Cargando ofertas...</div>;
  if (error) return <div className="p-8 text-center text-r">Error: {error}</div>;

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6 animate-fade-up">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-fraunces text-mm-g">Gestión de Ofertas</h2>
          <p className="text-sm text-mm-txs mt-1">Administra los descuentos y precios especiales de tus productos.</p>
        </div>
        <Button size="sm" className="w-full sm:w-auto whitespace-nowrap" onClick={() => { setEditingOffer(null); setIsModalOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Nueva Oferta
        </Button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
        {paginatedData.map(offer => {
          const product = offer.store_products?.catalog_products;
          const isExpired = offer.ends_at && new Date(offer.ends_at) < new Date();
          const isActive = offer.status === 'active' && !isExpired;
          const statusLabels: Record<string, string> = {
            pending: 'Pendiente',
            verified: 'Verificada',
            active: 'Activa',
            inactive: 'Inactiva',
          };

          return (
            <div key={offer.id} className="bg-white p-4 sm:p-6 rounded-[32px] border border-mm-crd shadow-sm relative overflow-hidden group hover:border-mm-g/40 transition-all flex flex-col">
              <div className="absolute top-0 right-0 w-24 h-24 bg-mm-g/5 -mr-8 -mt-8 rounded-full transition-transform group-hover:scale-110" />
              
              <div className="flex items-start justify-between mb-4 relative z-10">
                <div className="w-14 h-14 bg-mm-gbg rounded-2xl flex items-center justify-center overflow-hidden border border-mm-crd/30">
                  {offer.imageSignedUrl ? (
                    <img src={offer.imageSignedUrl} alt={product?.name || ''} className="w-full h-full object-cover" />
                  ) : (
                    <Tag className="w-6 h-6 text-mm-txw" />
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge
                    variant={isActive ? 'success' : offer.status === 'pending' ? 'warning' : 'default'}
                    className="whitespace-nowrap"
                  >
                    {isExpired ? 'Expirada' : statusLabels[offer.status] || offer.status}
                  </Badge>
                  {offer.is_featured && <Badge variant="oro" className="whitespace-nowrap">Destacada</Badge>}
                </div>
              </div>

              <div className="flex-grow relative z-10">
                {/* La tarjeta es `overflow-hidden`: sin `break-words` un nombre largo
                    no envuelve, se recorta y desaparece sin dejar rastro. */}
                <h3 className="text-lg font-bold text-mm-g mb-1 leading-tight break-words line-clamp-2">{product?.name || 'Producto Desconocido'}</h3>
                {offer.label && (
                  <p className="text-xs font-medium text-mm-oro mb-2 bg-mm-oro/10 inline-block px-2 py-1 rounded-md">{offer.label}</p>
                )}
                <div className="text-xs text-mm-txs space-y-1 mb-4">
                  <p>Inicia: {new Date(offer.starts_at).toLocaleDateString()}</p>
                  {offer.ends_at && <p>Termina: {new Date(offer.ends_at).toLocaleDateString()}</p>}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-4 border-t border-mm-gbg mt-auto relative z-10">
                <div className="min-w-0 truncate text-mm-g font-bold text-lg">
                  {offer.special_price 
                    ? fmt(offer.special_price) 
                    : offer.discount_pct ? `${offer.discount_pct}% OFF` : 'Sin precio'}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button 
                    className="p-2.5 sm:p-2 hover:bg-mm-gbg rounded-full text-mm-txw hover:text-mm-g transition-colors" 
                    onClick={() => { setEditingOffer(offer); setIsModalOpen(true); }}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    className="p-2.5 sm:p-2 hover:bg-mm-gbg rounded-full text-mm-txw hover:text-r transition-colors" 
                    onClick={() => deleteOffer(offer.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {offers.length === 0 && (
          <div className="col-span-full py-12 sm:py-20 bg-white/50 rounded-[40px] border-2 border-dashed border-mm-crd flex flex-col items-center justify-center">
            <Tag className="w-12 h-12 text-mm-txw mb-4 opacity-40" />
            <p className="text-mm-txw font-medium">No hay ofertas creadas aún</p>
            <Button variant="ghost" className="mt-4" onClick={() => { setEditingOffer(null); setIsModalOpen(true); }}>
              Crear mi primera oferta
            </Button>
          </div>
        )}
      </div>

      {/* Custom Pagination for Cards */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white px-3 sm:px-6 py-4 rounded-2xl border border-mm-crd shadow-sm mt-6">
          <p className="text-xs sm:text-sm text-mm-txs text-center sm:text-left">
            Mostrando <span className="font-bold text-mm-g">{(page - 1) * rowsPerPage + 1}</span> a <span className="font-bold text-mm-g">{Math.min(page * rowsPerPage, offers.length)}</span> de <span className="font-bold text-mm-g">{offers.length}</span> ofertas
          </p>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-xl bg-mm-gbg text-mm-g hover:bg-mm-crd disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-xl bg-mm-gbg text-mm-g hover:bg-mm-crd disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {isModalOpen && (
        <OfferModal
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setEditingOffer(null); }}
          onSave={saveOffer}
          initialData={editingOffer}
        />
      )}
    </div>
  );
}
