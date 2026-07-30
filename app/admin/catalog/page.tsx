'use client';

import { useEffect, useState, useMemo } from 'react';
import { Plus, Package, Edit2, Trash2, Store as StoreIcon, ChevronRight, Search } from 'lucide-react';
import { Database } from '../../../types/database_generated';
import { useStoreProducts, StoreProduct } from './hooks/useStoreProducts';
import { StoreProductModal } from './components/StoreProductModal';
import { BatchAssignModal } from './components/BatchAssignModal';
import { Table } from '../../../components/ui/table/components/Table';
import { useTable } from '../../../components/ui/table/hooks/useTable';
import { Button, Badge, normalizeText } from '@/src/components/Shared';
import { getSupabaseImageUrl, PRESET_THUMBNAIL } from '@/lib/supabase/supabase-image';

// Grouped data type for the table
type GroupedProduct = {
  id: string; // catalog_product_id
  name: string;
  cat: string;
  image_url: string | null;
  imageSignedUrl: string | null;
  items: StoreProduct[];
  totalStock: number;
  avgPrice: number;
  unit: string;
};

export default function CatalogAdmin() {
  const { storeProducts, loading, error, fetchStoreProducts, deleteStoreProduct, saveStoreProduct } = useStoreProducts();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<StoreProduct | null>(null);
  
  // Selection states
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string | number>>(new Set());
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);

  // States for search and filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categories, setCategories] = useState<Database['public']['Tables']['categories']['Row'][]>([]);
  const [stores, setStores] = useState<Database['public']['Tables']['stores']['Row'][]>([]);

  useEffect(() => {
    fetchStoreProducts();
  }, [fetchStoreProducts]);

  // Fetch categories and stores for filtering dropdowns
  useEffect(() => {
    fetch('/api/categories')
      .then((res) => res.json())
      .then((data) => {
        if (data.data) setCategories(data.data);
      })
      .catch((err) => console.error('Error fetching categories:', err));

    fetch('/api/stores')
      .then((res) => res.json())
      .then((data) => {
        if (data.data) setStores(data.data);
      })
      .catch((err) => console.error('Error fetching stores:', err));
  }, []);

  // Helper to get selected category and all its subcategories recursively
  const selectedCategoryIds = useMemo(() => {
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
  const sortedCategories = useMemo(() => {
    return [...categories]
      .map(c => ({
        ...c,
        displayName: c.parent_id 
          ? `${categories.find(p => p.id === c.parent_id)?.name || ''} > ${c.name}` 
          : c.name
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [categories]);

  // Filter raw storeProducts by selected filters
  const filteredStoreProducts = useMemo(() => {
    return storeProducts.filter((item) => {
      // 1. Search Query: matches catalog product name or description
      const matchesSearch =
        !searchQuery ||
        normalizeText(item.catalog_products?.name || '').includes(normalizeText(searchQuery)) ||
        normalizeText(item.catalog_products?.description || '').includes(normalizeText(searchQuery));

      // 2. Store: matches store ID
      const matchesStore = !selectedStore || item.store_id === selectedStore;

      // 3. Category: matches category ID
      const matchesCategory =
        !selectedCategory ||
        (item.catalog_products?.category_id && selectedCategoryIds.includes(item.catalog_products.category_id));

      return matchesSearch && matchesStore && matchesCategory;
    });
  }, [storeProducts, searchQuery, selectedStore, selectedCategory, selectedCategoryIds]);

  // Group the filtered storeProducts by catalog_product_id synchronously
  const groupedProducts = useMemo(() => {
    const groups = new Map<string, GroupedProduct>();
    
    for (const item of filteredStoreProducts) {
      const catId = item.catalog_product_id;
      if (!groups.has(catId)) {
        const publicUrl = item.catalog_products?.image_url
          ? getSupabaseImageUrl('products', item.catalog_products.image_url, PRESET_THUMBNAIL)
          : null;
        
        groups.set(catId, {
          id: catId,
          name: item.catalog_products?.name || 'Desconocido',
          cat: item.catalog_products?.categories?.name || 'Sin categoría',
          image_url: item.catalog_products?.image_url || null,
          imageSignedUrl: publicUrl,
          items: [],
          totalStock: 0,
          avgPrice: 0,
          unit: item.measurement_units?.abbreviation || '',
        });
      }
      
      const group = groups.get(catId)!;
      group.items.push(item);
      group.totalStock += item.stock;
    }

    // Calculate averages
    for (const group of groups.values()) {
      if (group.items.length > 0) {
        const sum = group.items.reduce((acc, curr) => acc + curr.price_per_unit, 0);
        group.avgPrice = Math.round(sum / group.items.length);
      }
    }

    return Array.from(groups.values());
  }, [filteredStoreProducts]);

  const {
    page, setPage, rowsPerPage, setRowsPerPage, sortKey, sortOrder, handleSort, paginatedData, totalPages
  } = useTable({ initialData: groupedProducts });

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedStore, selectedCategory, setPage]);

  const fmt = (price: number) => `$${price.toLocaleString('es-CO')}`;

  const columns = [
    {
      key: 'name',
      label: 'Producto',
      sortable: true,
      render: (item: GroupedProduct) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-mm-gbg rounded-lg flex items-center justify-center text-mm-txw overflow-hidden shrink-0 border border-mm-crd">
            {item.imageSignedUrl ? (
              <img
                src={item.imageSignedUrl}
                alt={item.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Red de seguridad: si el derivado WebP aún no existe, cae al original.
                  const img = e.currentTarget;
                  if (img.dataset.fallback) return;
                  img.dataset.fallback = '1';
                  img.src = item.image_url ? getSupabaseImageUrl('products', item.image_url) : '';
                }}
              />
            ) : (
              <Package className="w-6 h-6 text-mm-txw" />
            )}
          </div>
          <div>
            <span className="font-bold text-mm-g block leading-none mb-1">{item.name}</span>
            <span className="text-[10px] text-mm-txw font-bold uppercase">{item.cat}</span>
          </div>
        </div>
      )
    },
    {
      key: 'items',
      label: 'Tiendas',
      render: (item: GroupedProduct) => (
        <div className="flex items-center gap-2">
          <ChevronRight className="w-4 h-4 text-mm-txw group-hover/row:text-mm-g transition-colors" />
          <span className="text-xs font-bold text-mm-txs">
            {item.items.length} {item.items.length === 1 ? 'tienda' : 'tiendas'}
          </span>
        </div>
      )
    },
    {
      key: 'avgPrice',
      label: 'Precio Prom.',
      sortable: true,
      render: (item: GroupedProduct) => (
        <span className="text-sm font-bold text-mm-g">{fmt(item.avgPrice)}</span>
      )
    },
    {
      key: 'totalStock',
      label: 'Stock Total',
      sortable: true,
      render: (item: GroupedProduct) => (
        <Badge variant="oro" className="px-3 py-1 font-mono">
          {item.totalStock} {item.unit}
        </Badge>
      )
    }
  ];

  const renderExpandableContent = (item: GroupedProduct) => (
    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {item.items.map(storeProd => (
        <div key={storeProd.id} className="bg-white p-4 rounded-2xl border border-mm-crd/60 flex items-center justify-between hover:border-mm-g/40 transition-all shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-mm-gbg rounded-lg flex items-center justify-center text-lg border border-mm-crd/30">
              <StoreIcon className="w-4 h-4 text-mm-txw" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold text-mm-g leading-tight">{storeProd.stores?.name}</p>
                {(storeProd as any).is_featured && (
                  <Badge variant="oro" className="text-[8px] px-1.5 py-0">Destacado</Badge>
                )}
              </div>
              <p className="text-[9px] text-mm-txw font-bold uppercase tracking-tighter">
                {storeProd.stores?.marketplaces?.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right flex flex-col items-end mr-2">
              <p className="text-sm font-bold text-mm-g">{fmt(storeProd.price_per_unit)}</p>
              <p className="text-[10px] text-mm-txw font-bold">{storeProd.stock} {storeProd.measurement_units?.abbreviation}</p>
            </div>
            <div className="flex gap-1">
              <button 
                className="p-1.5 hover:bg-mm-gbg rounded-lg text-mm-txw hover:text-mm-g border border-transparent hover:border-mm-crd/50 transition-all"
                onClick={() => { setEditingProduct(storeProd); setIsModalOpen(true); }}
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button 
                className="p-1.5 hover:bg-mm-gbg rounded-lg text-mm-txw hover:text-r border border-transparent hover:border-mm-crd/50 transition-all"
                onClick={() => deleteStoreProduct(storeProd.id)}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  if (loading) return <div className="p-8 text-center text-mm-txs">Cargando inventarios...</div>;
  if (error) return <div className="p-8 text-center text-r">Error: {error}</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6 animate-fade-up">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-fraunces text-mm-g">Inventarios Consolidados</h2>
          <p className="text-sm text-mm-txs mt-1">Existencias y precios de los productos en cada tienda.</p>
        </div>
        <div className="flex gap-3">
          {selectedProductIds.size > 0 && (
            <Button size="sm" variant="oro" onClick={() => setIsBatchModalOpen(true)}>
              Asignar Seleccionados ({selectedProductIds.size})
            </Button>
          )}
          <Button size="sm" onClick={() => { setEditingProduct(null); setIsModalOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Asignar a Tienda
          </Button>
        </div>
      </div>

      {/* Filtros de Búsqueda, Tienda y Categoría */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-2xl border border-mm-crd shadow-sm animate-fade-up">
        {/* Buscador */}
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-mm-txw absolute left-4 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por producto o descripción..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-mm-crd bg-white focus:border-mm-g outline-none transition-all text-sm text-mm-g placeholder:text-mm-txw"
          />
        </div>

        {/* Tienda */}
        <div>
          <select
            value={selectedStore}
            onChange={(e) => setSelectedStore(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-mm-crd bg-white focus:border-mm-g outline-none transition-all text-sm text-mm-g cursor-pointer"
          >
            <option value="" className="text-mm-txw">Todas las tiendas</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Categoría */}
        <div>
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
        expandableContent={renderExpandableContent}
        selectedKeys={selectedProductIds}
        onSelectionChange={setSelectedProductIds}
        getRowKey={(item) => item.id}
      />

      {isModalOpen && (
        <StoreProductModal
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setEditingProduct(null); }}
          onSave={saveStoreProduct}
          initialData={editingProduct}
        />
      )}

      {isBatchModalOpen && (
        <BatchAssignModal
          isOpen={isBatchModalOpen}
          onClose={() => { 
            setIsBatchModalOpen(false); 
            setSelectedProductIds(new Set()); 
          }}
          selectedProductIds={Array.from(selectedProductIds) as string[]}
          onSave={(payload) => saveStoreProduct(null, payload)}
        />
      )}
    </div>
  );
}
