import React from 'react';
import { Tag, Plus, Trash2, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useOffers } from '../hooks/use-offers';
import { OfferModal } from './offer-modal';
import { Table } from '@/components/ui/table/components/Table';
import { Button, Badge } from '@/src/components/Shared';
import { fmt } from '@/src/constants';

export function OffersView() {
  const router = useRouter();
  const {
    myOffers,
    myProducts,
    isModalOpen,
    setIsModalOpen,
    newOffer,
    setNewOffer,
    handleAddOffer,
    handleDeleteOffer,
  } = useOffers();

  const columns = [
    {
      key: 'emoji',
      label: 'Icono',
      render: (item: any) => <span className="text-2xl">{item.emoji}</span>
    },
    {
      key: 'title',
      label: 'Título',
      render: (item: any) => (
        <div>
          <p className="font-bold text-mm-g">{item.title}</p>
          <p className="text-[10px] text-mm-txs italic">{item.desc}</p>
        </div>
      )
    },
    {
      key: 'productIds',
      label: 'Productos',
      render: (item: any) => {
        const prodNames = item.productIds
          .map((id: number) => myProducts.find(p => p.id === id)?.name)
          .filter(Boolean);
        return <span className="text-xs">{prodNames.join(', ') || 'N/A'}</span>;
      }
    },
    {
      key: 'value',
      label: 'Descuento',
      render: (item: any) => (
        <Badge variant={item.type === 'percentage' ? 'success' : 'oro'}>
          {item.type === 'percentage' ? `${item.value}% desc` : `${fmt(item.value)} desc`}
        </Badge>
      )
    },
    {
      key: 'endDate',
      label: 'Vence',
      render: (item: any) => <span className="text-xs font-mono font-bold">{item.endDate}</span>
    }
  ];

  const actions = (item: any) => (
    <button 
      onClick={() => handleDeleteOffer(item.id)}
      className="p-2 hover:bg-rl/10 rounded-full text-mm-txw hover:text-r transition-colors"
      title="Eliminar Oferta"
    >
      <Trash2 className="w-4 h-4" />
    </button>
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
        </div>
        
        <Button onClick={() => setIsModalOpen(true)} className="shadow-lg shadow-mm-g/10">
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
            {myOffers.length} ofertas
          </Badge>
        </div>

        <Table 
          data={myOffers}
          columns={columns}
          actions={actions}
          emptyMessage="No hay ofertas registradas en esta tienda."
        />
      </div>

      {/* Offer Modal */}
      <OfferModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        products={myProducts}
        newOffer={newOffer}
        setNewOffer={setNewOffer}
        onSubmit={handleAddOffer}
      />
    </div>
  );
}
