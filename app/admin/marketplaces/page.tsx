'use client'

import  { useEffect, useState } from 'react'
import { Plus, Building2, Edit2, Trash2, Eye } from 'lucide-react'
import { Database } from '../../../types/database_generated'
import { useMarketplaces } from './hooks/useMarketplaces'
import { MarketplaceModal } from './components/MarketplaceModal'
import { MarketplaceDetailModal } from './components/MarketplaceDetailModal'
import { Table } from '../../../components/ui/table/components/Table'
import { useTable } from '../../../components/ui/table/hooks/useTable'
import { Button, Badge } from '@/src/components/Shared'

type Marketplace = Database['public']['Tables']['marketplaces']['Row'] & {
  coverSignedUrl?: string | null
  logoSignedUrl?: string | null
}

export default function MarketplacesAdmin() {
  const { marketplaces, loading, error, fetchMarketplaces, deleteMarketplace, saveMarketplace } = useMarketplaces()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [editingPlaza, setEditingPlaza] = useState<Marketplace | null>(null)
  const [viewingSlug, setViewingSlug] = useState<string | null>(null)

  useEffect(() => {
    fetchMarketplaces()
  }, [])

  const {
    page, setPage, rowsPerPage, setRowsPerPage, sortKey, sortOrder, handleSort, paginatedData, totalPages
  } = useTable({ initialData: marketplaces })

  const columns = [
    {
      key: 'name',
      label: 'Plaza',
      sortable: true,
      render: (item: Marketplace) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-mm-gbg rounded-lg flex items-center justify-center text-2xl overflow-hidden border border-mm-crd shrink-0">
            {item.logoSignedUrl ? (
              <img src={item.logoSignedUrl} alt={item.name} className="w-full h-full object-cover" />
            ) : (
              <Building2 className="w-6 h-6 text-mm-txw" />
            )}
          </div>
          <span className="font-bold text-mm-g">{item.name}</span>
        </div>
      )
    },
    {
      key: 'city',
      label: 'Ciudad',
      sortable: true,
      render: (item: Marketplace) => <span className="text-sm text-mm-txs">{item.city}</span>
    },
    {
      key: 'slug',
      label: 'Slug',
      sortable: true,
      render: (item: Marketplace) => <span className="text-sm font-bold text-mm-g">{item.slug}</span>
    },
    {
      key: 'is_active',
      label: 'Estado',
      sortable: true,
      render: (item: Marketplace) => (
        <Badge variant={item.is_active ? 'success' : 'warning'}>
          {item.is_active ? 'Activa' : 'Inactiva'}
        </Badge>
      )
    }
  ]

  if (loading) return <div className="p-8 text-center text-mm-txs">Cargando plazas...</div>
  if (error) return <div className="p-8 text-center text-r">Error: {error}</div>

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6 animate-fade-up">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-fraunces text-mm-g">Gestión de Plazas</h2>
          <p className="text-sm text-mm-txs mt-1">Administra los marketplaces de la plataforma.</p>
        </div>
        <Button size="sm" onClick={() => { setEditingPlaza(null); setIsModalOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Nueva Plaza
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
        actions={(item: Marketplace) => (
          <div className="flex gap-2">
            <button 
              onClick={() => { setViewingSlug(item.slug); setIsDetailModalOpen(true); }}
              className="p-2 hover:bg-mm-gbg rounded-full text-mm-txw hover:text-mm-g transition-colors"
              title="Ver Detalles"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button 
              onClick={() => { setEditingPlaza(item); setIsModalOpen(true); }}
              className="p-2 hover:bg-mm-gbg rounded-full text-mm-txw hover:text-mm-g transition-colors"
              title="Editar Plaza"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button 
              onClick={() => deleteMarketplace(item.id)}
              className="p-2 hover:bg-mm-gbg rounded-full text-mm-txw hover:text-r transition-colors"
              title="Eliminar Plaza"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      />

      <MarketplaceModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingPlaza(null); }}
        onSave={saveMarketplace}
        initialData={editingPlaza}
      />

      {viewingSlug && (
        <MarketplaceDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => { setIsDetailModalOpen(false); setViewingSlug(null); }}
          slug={viewingSlug}
        />
      )}
    </div>
  )
}