'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import { Database } from '../../../types/database_generated';
import { useStoreProducts, StoreProduct } from './hooks/useStoreProducts';
import { StoreProductModal } from './components/StoreProductModal';
import { BatchAssignModal } from './components/BatchAssignModal';
import { Button } from '@/components/ui/button';
import { fuzzyFilter } from '@/lib/search/fuzzy';
import { PriceGrid } from '@/features/store-products/components/PriceGrid';
import { usePriceGrid } from '@/features/store-products/hooks/usePriceGrid';
import type { UnitOption } from '@/lib/store-products/price-grid';
import { toPriceGridRow } from './utils/price-grid-row';
import { leafCategoryOptions } from '@/lib/categories/picker';
import { ConfirmModal } from '../../../components/ui/confirm-modal/ConfirmModal';

export default function CatalogAdmin() {
  const { storeProducts, loading, error, fetchStoreProducts, deleteStoreProduct, saveStoreProduct } = useStoreProducts();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<StoreProduct | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StoreProduct | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Selection states
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string | number>>(new Set());
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);

  // States for search and filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categories, setCategories] = useState<Database['public']['Tables']['categories']['Row'][]>([]);
  const [stores, setStores] = useState<Database['public']['Tables']['stores']['Row'][]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);

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

    fetch('/api/measurement-units')
      .then((res) => res.json())
      .then((data) => {
        if (data.data) setUnits(data.data);
      })
      .catch((err) => console.error('Error fetching units:', err));

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
    const filtrados = storeProducts.filter((item) => {
      // 2. Store: matches store ID
      const matchesStore = !selectedStore || item.store_id === selectedStore;

      // 3. Category: matches category ID
      const matchesCategory =
        !selectedCategory ||
        (item.catalog_products?.category_id && selectedCategoryIds.includes(item.catalog_products.category_id));

      return matchesStore && matchesCategory;
    });
    // 1. La búsqueda, tolerante a errores de ortografía («bino» → vino), y los
    // que mejor coinciden primero.
    return fuzzyFilter(filtrados, searchQuery, (item) => [item.catalog_products?.name, item.catalog_products?.description]);
  }, [storeProducts, searchQuery, selectedStore, selectedCategory, selectedCategoryIds]);

  // La tabla tipo Excel: una fila por producto en cada tienda. Trabaja sobre
  // todos (un filtro no borra los cambios) y pinta los filtrados, ordenados por
  // producto para que las tiendas de un mismo producto queden juntas.
  const reload = useCallback(() => fetchStoreProducts(), [fetchStoreProducts]);
  const gridRows = useMemo(() => storeProducts.map(toPriceGridRow), [storeProducts]);
  // La categoría se edita en la tabla; es del catálogo maestro (todas las tiendas).
  const categoryOptions = useMemo(() => leafCategoryOptions(categories), [categories]);
  const grid = usePriceGrid(gridRows, units, reload, categoryOptions);
  const byId = useMemo(() => new Map(storeProducts.map((p) => [p.id, p])), [storeProducts]);
  const visibleRows = useMemo(() => {
    const filas = filteredStoreProducts.map(toPriceGridRow);
    return searchQuery.trim() ? filas : filas.sort((a, b) => a.name.localeCompare(b.name, 'es') || (a.storeName ?? '').localeCompare(b.storeName ?? '', 'es'));
  }, [filteredStoreProducts, searchQuery]);

  // «Asignar seleccionados» trabaja con productos del catálogo: marcar una fila
  // marca su producto en todas sus tiendas.
  const selection = useMemo(
    () => ({
      selected: new Set(
        storeProducts.filter((p) => selectedProductIds.has(p.catalog_product_id)).map((p) => p.id)
      ),
      toggle: (id: string) => {
        const cat = byId.get(id)?.catalog_product_id;
        if (!cat) return;
        setSelectedProductIds((prev) => {
          const next = new Set(prev);
          if (next.has(cat)) next.delete(cat);
          else next.add(cat);
          return next;
        });
      },
    }),
    [storeProducts, selectedProductIds, byId]
  );

  const rowActions = (row: { id: string }) => {
    const storeProd = byId.get(row.id);
    if (!storeProd) return null;
    return (
      <div className="flex gap-1">
        <button
          className="rounded-lg p-1.5 text-mm-txw transition-all hover:bg-mm-gbg hover:text-mm-g"
          title="Editar (código, destacado…)"
          onClick={() => {
            setEditingProduct(storeProd);
            setIsModalOpen(true);
          }}
        >
          <Edit2 className="h-3.5 w-3.5" />
        </button>
        <button
          className="rounded-lg p-1.5 text-mm-txw transition-all hover:bg-mm-gbg hover:text-r"
          title="Quitar de la tienda"
          onClick={() => setDeleteTarget(storeProd)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteStoreProduct(deleteTarget.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error eliminando el producto de la tienda';
      setDeleteError(msg);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  if (loading) return <div className="p-8 text-center text-mm-txs">Cargando inventarios...</div>;
  if (error) return <div className="p-8 text-center text-r">Error: {error}</div>;

  return (
    <div className="p-4 sm:p-8 space-y-6 animate-fade-up">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-display text-mm-g">Inventarios Consolidados</h2>
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

      <PriceGrid
        rows={visibleRows}
        grid={grid}
        units={units}
        rowActions={rowActions}
        showStore
        selection={selection}
        categories={categoryOptions}
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

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Eliminar producto de la tienda"
        message={`¿Estás seguro de eliminar "${deleteTarget?.catalog_products?.name}" del inventario de "${deleteTarget?.stores?.name}"? Esta acción no se puede deshacer.`}
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
