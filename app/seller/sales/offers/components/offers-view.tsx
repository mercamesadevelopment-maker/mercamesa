import React, { useState } from 'react';
import { Tag, Plus, Trash2, Edit2, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useOffers } from '../hooks/use-offers';
import { OfferModal } from '@/src/features/offers/components/OfferModal';
import { StoreOffer } from '@/src/features/offers/types/offer.types';
import { Table } from '@/components/ui/table/components/Table';
import { Button, Badge } from '@/src/components/Shared';
import { fmt } from '@/src/constants';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  verified: 'Verificada',
  active: 'Activa',
  inactive: 'Inactiva',
};

const STATUS_VARIANTS: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
  pending: 'warning',
  verified: 'default',
  active: 'success',
  inactive: 'error',
};

export function OffersView() {
  const router = useRouter();
  const {
    offers,
    saveOffer,
    deleteOffer,
    stores,
    storeId,
    selectStore,
  } = useOffers();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<StoreOffer | null>(null);

  const columns = [
    {
      key: 'product',
      label: 'Producto',
      render: (item: StoreOffer) => (
        <div>
          <p className="font-bold text-mm-g">{item.store_products?.catalog_products?.name || 'N/A'}</p>
          {item.label && <p className="text-[10px] text-mm-txs italic">{item.label}</p>}
        </div>
      )
    },
    {
      key: 'discount',
      label: 'Descuento',
      render: (item: StoreOffer) => (
        <Badge variant={item.discount_pct !== null ? 'success' : 'oro'}>
          {item.discount_pct !== null ? `${item.discount_pct}% desc` : item.special_price ? `${fmt(item.special_price)} desc` : 'N/A'}
        </Badge>
      )
    },
    {
      key: 'ends_at',
      label: 'Vence',
      render: (item: StoreOffer) => (
        <span className="text-xs font-mono font-bold">
          {item.ends_at ? new Date(item.ends_at).toLocaleDateString() : 'Sin límite'}
        </span>
      )
    },
    {
      key: 'status',
      label: 'Estado',
      render: (item: StoreOffer) => (
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANTS[item.status] || 'default'}>
            {STATUS_LABELS[item.status] || item.status}
          </Badge>
          {item.is_featured && <Badge variant="oro">Destacada</Badge>}
        </div>
      )
    }
  ];

  const actions = (item: StoreOffer) => (
    <div className="flex items-center gap-1">
      <button
        onClick={() => { setEditingOffer(item); setIsModalOpen(true); }}
        className="p-2 hover:bg-mm-gbg rounded-full text-mm-txw hover:text-mm-g transition-colors"
        title="Editar Oferta"
      >
        <Edit2 className="w-4 h-4" />
      </button>
      <button
        onClick={() => deleteOffer(item.id)}
        className="p-2 hover:bg-rl/10 rounded-full text-mm-txw hover:text-r transition-colors"
        title="Eliminar Oferta"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/seller/sales')}
            className="p-2.5 hover:bg-mm-gbg rounded-full text-mm-g transition-colors border border-mm-crd shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-4xl font-fraunces text-mm-g mb-2">Ofertas por Tienda</h1>
            <p className="text-mm-txs">Registra y administra ofertas y promociones especiales.</p>
          </div>
          {stores.length > 1 && (
            <div className="flex flex-col gap-1 min-w-[200px] ml-4">
              <label className="text-[10px] font-black uppercase tracking-widest text-mm-txw">Tienda Activa</label>
              <select
                value={storeId || ''}
                onChange={(e) => selectStore(e.target.value)}
                className="bg-white text-mm-g font-semibold text-sm border border-mm-crd rounded-xl px-4 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-mm-g/20 cursor-pointer"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <Button onClick={() => { setEditingOffer(null); setIsModalOpen(true); }} className="shadow-lg shadow-mm-g/10">
          <Plus className="w-5 h-5 mr-1" /> Crear Oferta
        </Button>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-3xl border border-mm-crd shadow-sm overflow-hidden">
        <div className="p-6 border-b border-mm-crd flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-mm-gbg rounded-xl flex items-center justify-center text-mm-g">
               <Tag className="w-5 h-5" />
             </div>
             <h3 className="text-xl font-fraunces text-mm-g">Promociones Activas</h3>
          </div>
          <Badge variant="oro" className="text-xs px-4 py-1.5 uppercase shadow-inner">
            {offers.length} ofertas
          </Badge>
        </div>

        <Table
          data={offers}
          columns={columns}
          actions={actions}
          emptyMessage="No hay ofertas registradas en esta tienda."
        />
      </div>

      {/* Offer Modal */}
      <OfferModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingOffer(null); }}
        onSave={saveOffer}
        initialData={editingOffer}
        storeId={storeId ?? undefined}
        allowFeatured={false}
        allowStatusEdit={false}
      />
    </div>
  );
}
