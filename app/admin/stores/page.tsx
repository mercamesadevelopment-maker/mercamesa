'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Store as StoreIcon, Edit2, Trash2, Users } from 'lucide-react';
import { Database } from '../../../types/database_generated';
import { useStores } from './hooks/useStores';
import { StoreModal } from './components/StoreModal';
import { StoreMembersModal } from './components/StoreMembersModal';
import { Table } from '../../../components/ui/table/components/Table';
import { useTable } from '../../../components/ui/table/hooks/useTable';
import { Button, Badge } from '@/src/components/Shared';
import { AnimatePresence } from 'framer-motion';

type Store = Database['public']['Tables']['stores']['Row'] & {
  coverSignedUrl?: string | null;
  logoSignedUrl?: string | null;
  marketplaces?: { name: string } | null;
  store_members?: Array<{
    id: string;
    role_id: string;
    roles: { name: string; label: string } | null;
    profiles: { id: string; full_name: string; email: string } | null;
  }> | null;
};

export default function StoresAdmin() {
  const { stores, loading, error, fetchStores, deleteStore, saveStore } = useStores();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [selectedStoreForMembers, setSelectedStoreForMembers] = useState<Store | null>(null);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  const {
    page, setPage, rowsPerPage, setRowsPerPage, sortKey, sortOrder, handleSort, paginatedData, totalPages
  } = useTable({ initialData: stores });

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
              onClick={() => { setSelectedStoreForMembers(item); setIsMembersModalOpen(true); }}
              className="p-2 hover:bg-mm-gbg rounded-full text-mm-txw hover:text-mm-g transition-colors"
              title="Miembros"
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
    </div>
  );
}
