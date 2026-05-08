'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Package, Edit2, Trash2 } from 'lucide-react';
import { Database } from '../../../types/database_generated';
import { useProducts } from './hooks/useProducts';
import { ProductModal } from './components/ProductModal';
import { Table } from '../../../components/ui/table/components/Table';
import { useTable } from '../../../components/ui/table/hooks/useTable';
import { Button, Badge } from '@/src/components/Shared';

type Product = Database['public']['Tables']['catalog_products']['Row'] & {
  imageSignedUrl?: string | null;
  categories?: { name: string } | null;
  measurement_units?: { abbreviation: string } | null;
};

export default function ProductsAdmin() {
  const { products, loading, error, fetchProducts, deleteProduct, saveProduct } = useProducts();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const {
    page, setPage, rowsPerPage, setRowsPerPage, sortKey, sortOrder, handleSort, paginatedData, totalPages
  } = useTable({ initialData: products });

  const columns = [
    {
      key: 'name',
      label: 'Producto',
      sortable: true,
      render: (item: Product) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-mm-gbg rounded-lg flex items-center justify-center text-2xl overflow-hidden border border-mm-crd shrink-0">
            {item.imageSignedUrl ? (
              <img src={item.imageSignedUrl} alt={item.name} className="w-full h-full object-cover" />
            ) : (
              <Package className="w-6 h-6 text-mm-txw" />
            )}
          </div>
          <span className="font-bold text-mm-g">{item.name}</span>
        </div>
      )
    },
    {
      key: 'category',
      label: 'Categoría',
      sortable: true,
      render: (item: Product) => (
        <Badge variant="default">
          {item.categories?.name || 'Sin Categoría'}
        </Badge>
      )
    },
    {
      key: 'default_unit',
      label: 'Unidad Defecto',
      sortable: true,
      render: (item: Product) => (
        <span className="text-sm text-mm-txs font-medium">
          {item.measurement_units?.abbreviation || 'N/A'}
        </span>
      )
    },
    {
      key: 'is_active',
      label: 'Estado',
      sortable: true,
      render: (item: Product) => (
        <Badge variant={item.is_active ? 'success' : 'warning'}>
          {item.is_active ? 'Activo' : 'Inactivo'}
        </Badge>
      )
    }
  ];

  if (loading) return <div className="p-8 text-center text-mm-txs">Cargando catálogo...</div>;
  if (error) return <div className="p-8 text-center text-r">Error: {error}</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6 animate-fade-up">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-fraunces text-mm-g">Catálogo Maestro</h2>
          <p className="text-sm text-mm-txs mt-1">Productos preestablecidos disponibles para las tiendas.</p>
        </div>
        <Button size="sm" onClick={() => { setEditingProduct(null); setIsModalOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Nuevo Item
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
        actions={(item: Product) => (
          <div className="flex gap-2">
            <button 
              onClick={() => { setEditingProduct(item); setIsModalOpen(true); }}
              className="p-2 hover:bg-mm-gbg rounded-full text-mm-txw hover:text-mm-g transition-colors"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button 
              onClick={() => deleteProduct(item.id)}
              className="p-2 hover:bg-mm-gbg rounded-full text-mm-txw hover:text-r transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      />

      {isModalOpen && (
        <ProductModal
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setEditingProduct(null); }}
          onSave={saveProduct}
          initialData={editingProduct}
        />
      )}
    </div>
  );
}
