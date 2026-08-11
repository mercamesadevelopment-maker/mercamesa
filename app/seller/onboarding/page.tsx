'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, FileText, Search, Store as StoreIcon, ArrowRight } from 'lucide-react';
import { useStores, Store } from '../../admin/stores/hooks/useStores';
import { StoreDocumentsModal } from '@/app/admin/stores/components/StoreDocumentsModal';
import { Table } from '../../../components/ui/table/components/Table';
import { useTable } from '../../../components/ui/table/hooks/useTable';
import { Button, Badge } from '@/src/components/Shared';
import { AnimatePresence } from 'motion/react';
import { Database } from '../../../types/database_generated';

type Marketplace = Database['public']['Tables']['marketplaces']['Row'];

export default function SellerOnboarding() {
  const router = useRouter();
  const { stores, requiredDocumentTypes, loading, error, fetchStores } = useStores();
  const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);
  const [selectedStoreForDocs, setSelectedStoreForDocs] = useState<Store | null>(null);

  const [marketplaces, setMarketplaces] = useState<Marketplace[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMarketplace, setSelectedMarketplace] = useState('');

  // Fetch only the stores where the user is a member
  useEffect(() => {
    fetchStores(true);
  }, [fetchStores]);

  useEffect(() => {
    fetch('/api/marketplaces')
      .then(res => res.json())
      .then(data => { if (data.data) setMarketplaces(data.data); });
  }, []);

  const filteredStores = React.useMemo(() => {
    return stores.filter(store => {
      const matchesName = store.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesMarketplace = !selectedMarketplace || store.marketplace_id === selectedMarketplace;
      return matchesName && matchesMarketplace;
    });
  }, [stores, searchTerm, selectedMarketplace]);

  const {
    page, setPage, rowsPerPage, setRowsPerPage, sortKey, sortOrder, handleSort, paginatedData, totalPages
  } = useTable({ initialData: filteredStores });

  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedMarketplace, setPage]);

  const isStoreVerified = (store: Store) => {
    const requiredIds = requiredDocumentTypes.map((t) => t.id);
    if (requiredIds.length === 0) return false;

    const storeDocs = store.store_documents || [];
    const approvedTypeIds = storeDocs
      .filter((d) => d.status === 'approved')
      .map((d) => d.document_type_id);

    return requiredIds.every((id) => approvedTypeIds.includes(id));
  };

  const columns = [
    {
      key: 'name',
      label: 'Tienda',
      sortable: true,
      render: (item: Store) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-mm-gbg rounded-lg flex items-center justify-center text-2xl overflow-hidden border border-mm-crd shrink-0">
            {item.logoSignedUrl ? (
              <img src={item.logoSignedUrl} alt={item.name} className="w-full h-full object-cover" />
            ) : (
              <StoreIcon className="w-6 h-6 text-mm-txw" />
            )}
          </div>
          <div>
            <span className="font-bold text-mm-g">{item.name}</span>
            <p className="text-[10px] text-mm-txw uppercase font-bold">{item.slug}</p>
          </div>
        </div>
      )
    },
    {
      key: 'marketplace',
      label: 'Plaza',
      sortable: true,
      render: (item: Store) => <span className="text-sm text-mm-txs">{item.marketplaces?.name || 'N/A'}</span>
    },
    {
      key: 'owner',
      label: 'Dueño',
      sortable: true,
      render: (item: Store) => {
        const owner = item.store_members?.find(m => m.roles?.name === 'store_owner');
        return <span className="text-sm text-mm-txs">{owner?.profiles?.full_name || item.contact_name || 'Sin dueño'}</span>;
      }
    },
    {
      key: 'verification',
      label: 'Documentos',
      sortable: false,
      render: (item: Store) => {
        const verified = isStoreVerified(item);
        return (
          <Badge variant={verified ? 'success' : 'warning'}>
            {verified ? 'Verificada' : 'Pendiente'}
          </Badge>
        );
      }
    }
  ];

  const handleSavedDocs = () => {
    fetchStores(true);
  };

  if (loading) return <div className="p-8 text-center text-mm-txs">Cargando tiendas de vendedor...</div>;
  if (error) return <div className="p-8 text-center text-r">Error: {error}</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6 animate-fade-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-fraunces text-mm-g">Finalizar Registro de Tienda</h2>
          <p className="text-sm text-mm-txs mt-1">Para poder operar en la plataforma, debes subir y verificar la documentación requerida.</p>
        </div>
      </div>

      {/* Filtros de Búsqueda y Plaza */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded-2xl border border-mm-crd shadow-sm">
        {/* Buscador por Nombre */}
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-mm-txw absolute left-4 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar tienda por nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-mm-crd bg-white focus:border-mm-g outline-none transition-all text-sm text-mm-g placeholder:text-mm-txw"
          />
        </div>

        {/* Plaza / Marketplace */}
        <div>
          <select
            value={selectedMarketplace}
            onChange={(e) => setSelectedMarketplace(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-mm-crd bg-white focus:border-mm-g outline-none transition-all text-sm text-mm-g cursor-pointer"
          >
            <option value="" className="text-mm-txw">Todas las plazas</option>
            {marketplaces.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Table
        data={paginatedData}
        columns={columns}
        sortKey={sortKey}
        sortOrder={sortOrder}
        onSort={handleSort}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={setRowsPerPage}
        actions={(item: Store) => {
          const verified = isStoreVerified(item);
          return (
            <div className="flex gap-2">
              {!verified ? (
                <Button 
                  size="sm"
                  onClick={() => { setSelectedStoreForDocs(item); setIsDocsModalOpen(true); }}
                  className="flex items-center gap-2"
                  title="Finalizar registro de documentación"
                >
                  <FileText className="w-4 h-4" /> Finalizar Registro
                </Button>
              ) : (
                <Button 
                  size="sm"
                  variant="secondary"
                  onClick={() => router.push('/seller/dashboard')}
                  className="flex items-center gap-2"
                  title="Ir al panel principal"
                >
                  <Check className="w-4 h-4" /> Ir a mi Panel <ArrowRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          );
        }}
      />

      <AnimatePresence>
        {isDocsModalOpen && selectedStoreForDocs && (
          <StoreDocumentsModal
            isOpen={isDocsModalOpen}
            onClose={() => { setIsDocsModalOpen(false); setSelectedStoreForDocs(null); }}
            storeId={selectedStoreForDocs.id}
            storeName={selectedStoreForDocs.name}
            onSaved={handleSavedDocs}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
