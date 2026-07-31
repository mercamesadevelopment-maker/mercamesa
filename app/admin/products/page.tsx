'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Package, Edit2, Trash2, Search } from 'lucide-react';
import { Database } from '../../../types/database_generated';
import { useProducts } from './hooks/useProducts';
import { ProductModal } from './components/ProductModal';
import { Table } from '../../../components/ui/table/components/Table';
import { useTable } from '../../../components/ui/table/hooks/useTable';
import { Button, Badge, normalizeText } from '@/src/components/Shared';
import { ConfirmModal } from '../../../components/ui/confirm-modal/ConfirmModal';

type Product = Database['public']['Tables']['catalog_products']['Row'] & {
  imageSignedUrl?: string | null;
  categories?: { name: string } | null;
  measurement_units?: { abbreviation: string } | null;
};

export default function ProductsAdmin() {
  const { products, loading, error, fetchProducts, deleteProduct, saveProduct } = useProducts();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // States for search and filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categories, setCategories] = useState<Database['public']['Tables']['categories']['Row'][]>([]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Fetch categories for filtering dropdown
  useEffect(() => {
    fetch('/api/categories')
      .then((res) => res.json())
      .then((data) => {
        if (data.data) setCategories(data.data);
      })
      .catch((err) => console.error('Error fetching categories:', err));
  }, []);

  // Helper to get selected category and all its subcategories recursively
  const selectedCategoryIds = React.useMemo(() => {
    if (!selectedCategory) return [];
    const result = [selectedCategory];
    const queue = [selectedCategory];
    while (queue.length > 0) {
      const currentId = queue.shift();
      const children = categories.filter(c => c.parent_id === currentId).map(c => c.id);
      for (const childId of children) {
        if (!result.includes(childId)) {
          result.push(childId);
          queue.push(childId);
        }
      }
    }
    return result;
  }, [selectedCategory, categories]);

  // Sort and build hierarchy paths for categories dropdown
  const sortedCategories = React.useMemo(() => {
    return [...categories]
      .map(c => ({
        ...c,
        displayName: c.parent_id 
          ? `${categories.find(p => p.id === c.parent_id)?.name || ''} > ${c.name}` 
          : c.name
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [categories]);

  const filteredProducts = React.useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        normalizeText(product.name).includes(normalizeText(searchQuery)) ||
        normalizeText(product.description || '').includes(normalizeText(searchQuery));
      
      const matchesCategory =
        !selectedCategory ||
        (product.category_id && selectedCategoryIds.includes(product.category_id));
      
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory, selectedCategoryIds]);

  const {
    page, setPage, rowsPerPage, setRowsPerPage, sortKey, sortOrder, handleSort, paginatedData, totalPages
  } = useTable({ initialData: filteredProducts });

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedCategory, setPage]);

  const columns = [
    {
      key: 'name',
      label: 'Producto',
      sortable: true,
      render: (item: Product) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-mm-gbg rounded-lg flex items-center justify-center text-2xl overflow-hidden border border-mm-crd shrink-0 relative">
            {item.imageSignedUrl ? (
              <img
                src={item.imageSignedUrl}
                alt={item.name}
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
              />
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

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteProduct(deleteTarget.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error eliminando el producto';
      setDeleteError(msg);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

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

      {/* Filtros de Búsqueda y Categoría */}
      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-2xl border border-mm-crd shadow-sm">
        <div className="flex-1 relative flex items-center">
          <Search className="w-4 h-4 text-mm-txw absolute left-4 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por nombre o descripción..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-mm-crd bg-white focus:border-mm-g outline-none transition-all text-sm text-mm-g placeholder:text-mm-txw"
          />
        </div>
        <div className="w-full sm:w-64">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-mm-crd bg-white focus:border-mm-g outline-none transition-all text-sm text-mm-g cursor-pointer"
          >
            <option value="" className="text-mm-txw">Todas las categorías</option>
            {sortedCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
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
        actions={(item: Product) => (
          <div className="flex gap-2">
            <button 
              onClick={() => { setEditingProduct(item); setIsModalOpen(true); }}
              className="p-2 hover:bg-mm-gbg rounded-full text-mm-txw hover:text-mm-g transition-colors"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setDeleteTarget(item)}
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

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Eliminar producto"
        message={`¿Estás seguro de eliminar "${deleteTarget?.name}" del catálogo? Esta acción no se puede deshacer.`}
        variant="danger"
        confirmText="Eliminar"
        isLoading={isDeleting}
      />

      <ConfirmModal
        isOpen={!!deleteError}
        onClose={() => setDeleteError(null)}
        onConfirm={() => setDeleteError(null)}
        title="No se puede eliminar"
        message={deleteError || ''}
        variant="warning"
        confirmText="Entendido"
        hideCancel
      />
    </div>
  );
}
