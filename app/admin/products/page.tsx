'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Package, Edit2, Trash2, Search } from 'lucide-react';
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

  // Filter products by search query and category
  const filteredProducts = React.useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = !selectedCategory || product.category_id === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

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
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
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
