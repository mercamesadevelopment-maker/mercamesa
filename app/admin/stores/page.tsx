'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Store as StoreIcon, Edit2, Trash2, Users, FileText, Search } from 'lucide-react';
import { useStores, Store } from './hooks/useStores';
import { StoreModal } from './components/StoreModal';
import { StoreMembersModal } from './components/StoreMembersModal';
import { StoreDocumentsModal } from './components/StoreDocumentsModal';
import { Table } from '../../../components/ui/table/components/Table';
import { useTable } from '../../../components/ui/table/hooks/useTable';
import { Button, Badge } from '@/src/components/Shared';
import { AnimatePresence } from 'motion/react';
import { Database } from '../../../types/database_generated';

type Marketplace = Database['public']['Tables']['marketplaces']['Row'];

export default function StoresAdmin() {
  const { stores, requiredDocumentTypes, loading, error, fetchStores, deleteStore, saveStore } = useStores();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [selectedStoreForMembers, setSelectedStoreForMembers] = useState<Store | null>(null);
  const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);
  const [selectedStoreForDocs, setSelectedStoreForDocs] = useState<Store | null>(null);

  const [marketplaces, setMarketplaces] = useState<Marketplace[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMarketplace, setSelectedMarketplace] = useState('');

  useEffect(() => {
    fetchStores();
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
    },
    {
      key: 'is_active',
      label: 'Estado',
      sortable: true,
      render: (item: Store) => (
        <Badge variant={item.is_active ? 'success' : 'warning'}>
          {item.is_active ? 'Activa' : 'Inactiva'}
        </Badge>
      )
    }
  ];

  if (loading) return <div className="p-8 text-center text-mm-txs">Cargando tiendas...</div>;
  if (error) return <div className="p-8 text-center text-r">Error: {error}</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6 animate-fade-up">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-fraunces text-mm-g">Gestión de Tiendas</h2>
          <p className="text-sm text-mm-txs mt-1">Administra los comercios y tiendas dentro de las plazas.</p>
        </div>
        <Button size="sm" onClick={() => { setEditingStore(null); setIsModalOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Nueva Tienda
        </Button>
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
        actions={(item: Store) => (
          <div className="flex gap-2">
            <button 
              onClick={() => { setSelectedStoreForDocs(item); setIsDocsModalOpen(true); }}
              className="p-2 hover:bg-mm-gbg rounded-full text-mm-txw hover:text-mm-g transition-colors"
              title="Documentos"
            >
              <FileText className="w-4 h-4" />
            </button>
            <button 
              onClick={() => { setSelectedStoreForMembers(item); setIsMembersModalOpen(true); }}
              disabled={!isStoreVerified(item)}
              className={`p-2 rounded-full transition-colors ${
                isStoreVerified(item)
                  ? 'hover:bg-mm-gbg text-mm-txw hover:text-mm-g'
                  : 'opacity-40 cursor-not-allowed text-mm-txw/50'
              }`}
              title={isStoreVerified(item) ? "Miembros" : "Verificación de documentos requerida"}
            >
              <Users className="w-4 h-4" />
            </button>
            <button 
              onClick={() => { setEditingStore(item); setIsModalOpen(true); }}
              className="p-2 hover:bg-mm-gbg rounded-full text-mm-txw hover:text-mm-g transition-colors"
              title="Editar"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button 
              onClick={() => deleteStore(item.id)}
              className="p-2 hover:bg-mm-gbg rounded-full text-mm-txw hover:text-r transition-colors"
              title="Eliminar"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      />

      <AnimatePresence>
        {isModalOpen && (
          <StoreModal
            isOpen={isModalOpen}
            onClose={() => { setIsModalOpen(false); setEditingStore(null); }}
            onSave={saveStore}
            initialData={editingStore}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isMembersModalOpen && selectedStoreForMembers && (
          <StoreMembersModal
            isOpen={isMembersModalOpen}
            onClose={() => { setIsMembersModalOpen(false); setSelectedStoreForMembers(null); }}
            storeId={selectedStoreForMembers.id}
            storeName={selectedStoreForMembers.name}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDocsModalOpen && selectedStoreForDocs && (
          <StoreDocumentsModal
            isOpen={isDocsModalOpen}
            onClose={() => { setIsDocsModalOpen(false); setSelectedStoreForDocs(null); }}
            storeId={selectedStoreForDocs.id}
            storeName={selectedStoreForDocs.name}
            onSaved={fetchStores}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
