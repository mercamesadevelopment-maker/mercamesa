'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Package, Edit2, Trash2, Search, Upload } from 'lucide-react';
import { Database } from '../../../types/database_generated';
import { useProducts } from './hooks/useProducts';
import { ProductModal } from './components/ProductModal';
import { BulkImportModal } from './components/BulkImportModal';
import { Table } from '../../../components/ui/table/components/Table';
import { Button, Badge, normalizeText } from '@/src/components/Shared';
import { ConfirmModal } from '../../../components/ui/confirm-modal/ConfirmModal';

type Product = Database['public']['Tables']['catalog_products']['Row'] & {
  imageSignedUrl?: string | null;
  categories?: { name: string } | null;
  measurement_units?: { abbreviation: string } | null;
};

interface StoreGroup {
  id: string;
  name: string;
}

/** Valor del filtro para "los que no son exclusivos de nadie". */
const PUBLIC_FILTER = '__public__';

export default function ProductsAdmin() {
  const { products, total, loading, error, fetchProducts, deleteProduct, saveProduct } =
    useProducts();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  /**
   * Paginación, búsqueda, filtros y orden viven ahora en el servidor.
   *
   * Antes esta pantalla se traía las 3.588 filas del catálogo —2,78 MB— y
   * filtraba en memoria, clonando el arreglo entero con cada tecla y con cada
   * ordenamiento. Ahora pide de a una página: unos 17 kB.
   */
  /** Para no volver a mostrar la pantalla de carga completa tras la primera vez. */
  const yaCargoUnaVez = React.useRef(false);

  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // States for search and filtering
  const [searchQuery, setSearchQuery] = useState('');
  // El término con rebote: sin esto cada tecla sería una consulta a la base.
  const [searchAplicada, setSearchAplicada] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categories, setCategories] = useState<Database['public']['Tables']['categories']['Row'][]>([]);

  // Exclusividad por grupo de tiendas
  const [storeGroups, setStoreGroups] = useState<StoreGroup[]>([]);
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [bulkGroupId, setBulkGroupId] = useState('');
  const [isApplyingGroup, setIsApplyingGroup] = useState(false);
  const [isGroupConfirmOpen, setIsGroupConfirmOpen] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);

  // Rebote del buscador: 350 ms sin teclear antes de ir al servidor.
  useEffect(() => {
    const t = setTimeout(() => setSearchAplicada(normalizeText(searchQuery)), 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    fetch('/api/admin/store-groups')
      .then((res) => res.json())
      .then((data) => {
        if (data.data) setStoreGroups(data.data);
      })
      .catch((err) => console.error('Error fetching store groups:', err));
  }, []);

  const groupNameById = React.useMemo(
    () => new Map(storeGroups.map((group) => [group.id, group.name])),
    [storeGroups]
  );

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

  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));

  // Vuelve a la primera página cuando cambia lo que se está filtrando: quedarse
  // en la página 7 de un resultado que ahora tiene dos es quedarse en blanco.
  useEffect(() => {
    setPage(1);
  }, [searchAplicada, selectedCategory, selectedGroupFilter, rowsPerPage]);

  /**
   * La única consulta al servidor. Se vuelve a lanzar cuando cambia cualquier
   * cosa que la define, y `fetchProducts` descarta las respuestas que lleguen
   * fuera de orden.
   */
  const recargar = React.useCallback(() => {
    fetchProducts({
      page,
      pageSize: rowsPerPage,
      search: searchAplicada,
      categoryIds: selectedCategoryIds,
      group: selectedGroupFilter,
      sort: sortKey,
      dir: sortOrder,
    });
  }, [
    fetchProducts, page, rowsPerPage, searchAplicada,
    selectedCategoryIds, selectedGroupFilter, sortKey, sortOrder,
  ]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  useEffect(() => {
    if (!loading) yaCargoUnaVez.current = true;
  }, [loading]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const bulkGroupName = bulkGroupId ? groupNameById.get(bulkGroupId) : null;

  const bulkGroupMessage = bulkGroupName
    ? `Se marcarán ${selectedIds.size} producto(s) como exclusivos de "${bulkGroupName}". Solo las tiendas de ese grupo podrán publicarlos.`
    : `Se volverán públicos ${selectedIds.size} producto(s). Cualquier tienda podrá publicarlos con sus imágenes.`;

  const handleApplyGroup = async () => {
    if (selectedIds.size === 0) return;

    setIsApplyingGroup(true);
    try {
      const res = await fetch('/api/products/bulk-group', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_ids: Array.from(selectedIds),
          owner_group_id: bulkGroupId || null,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Error al aplicar el grupo');
      }

      setSelectedIds(new Set());
      setIsGroupConfirmOpen(false);
      recargar();
    } catch (err: unknown) {
      setIsGroupConfirmOpen(false);
      setGroupError(err instanceof Error ? err.message : 'Error al aplicar el grupo');
    } finally {
      setIsApplyingGroup(false);
    }
  };

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
      key: 'owner_group_id',
      label: 'Exclusivo de',
      sortable: true,
      render: (item: Product) =>
        item.owner_group_id ? (
          <Badge variant="oro">{groupNameById.get(item.owner_group_id) || 'Grupo'}</Badge>
        ) : (
          <span className="text-mm-txw italic text-sm">Público</span>
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
      recargar();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error eliminando el producto';
      setDeleteError(msg);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  /**
   * La pantalla completa de carga es solo para la PRIMERA vez.
   *
   * Ahora cada tecla del buscador lanza una consulta; si `loading` siguiera
   * reemplazando toda la página, el campo de búsqueda desaparecería y perdería
   * el foco a media palabra. Después de la primera carga, el estado de espera se
   * muestra sin desmontar nada.
   */
  if (loading && !yaCargoUnaVez.current) {
    return <div className="p-8 text-center text-mm-txs">Cargando catálogo...</div>;
  }
  if (error && products.length === 0) {
    return <div className="p-8 text-center text-r">Error: {error}</div>;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6 animate-fade-up">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-fraunces text-mm-g">Catálogo Maestro</h2>
          <p className="text-sm text-mm-txs mt-1">Productos preestablecidos disponibles para las tiendas.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button size="sm" variant="outline" onClick={() => setIsBulkImportOpen(true)}>
            <Upload className="w-4 h-4 mr-2" /> Carga masiva
          </Button>
          <Button size="sm" onClick={() => { setEditingProduct(null); setIsModalOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Nuevo Item
          </Button>
        </div>
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
        <div className="w-full sm:w-56">
          <select
            value={selectedGroupFilter}
            onChange={(e) => setSelectedGroupFilter(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-mm-crd bg-white focus:border-mm-g outline-none transition-all text-sm text-mm-g cursor-pointer"
          >
            <option value="">Exclusividad: todas</option>
            <option value={PUBLIC_FILTER}>Solo públicos</option>
            {storeGroups.map((group) => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Acción masiva: aparece solo con filas seleccionadas */}
      {selectedIds.size > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-mm-gbg/40 p-4 rounded-2xl border border-mm-crd">
          <span className="text-sm font-bold text-mm-g">
            {selectedIds.size} producto(s) seleccionado(s)
          </span>
          <select
            value={bulkGroupId}
            onChange={(e) => setBulkGroupId(e.target.value)}
            className="px-4 py-2 rounded-xl border border-mm-crd bg-white focus:border-mm-g outline-none text-sm text-mm-g cursor-pointer"
          >
            <option value="">Público (cualquier tienda)</option>
            {storeGroups.map((group) => (
              <option key={group.id} value={group.id}>Exclusivo de {group.name}</option>
            ))}
          </select>
          <Button size="sm" onClick={() => setIsGroupConfirmOpen(true)} disabled={isApplyingGroup}>
            {isApplyingGroup ? 'Aplicando...' : 'Aplicar'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>
            Quitar selección
          </Button>
        </div>
      )}

      {/* Con datos ya en pantalla, el error y la espera se muestran sin desmontar
          la tabla ni el buscador. */}
      {error && products.length > 0 && (
        <div className="rounded-2xl bg-rl px-4 py-3 text-sm font-medium text-r">{error}</div>
      )}

      <div className={loading ? 'pointer-events-none opacity-60 transition-opacity' : 'transition-opacity'}>
      <Table
        data={products}
        columns={columns}
        selectedKeys={selectedIds}
        onSelectionChange={setSelectedIds}
        getRowKey={(item: Product) => item.id}
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
      </div>

      {isModalOpen && (
        <ProductModal
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setEditingProduct(null); }}
          onSave={async (id, data) => {
            await saveProduct(id, data);
            recargar();
          }}
          initialData={editingProduct}
        />
      )}

      <BulkImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        onImported={recargar}
      />

      <ConfirmModal
        isOpen={isGroupConfirmOpen}
        onClose={() => setIsGroupConfirmOpen(false)}
        onConfirm={handleApplyGroup}
        title={bulkGroupName ? 'Marcar como exclusivos' : 'Volver públicos'}
        message={bulkGroupMessage}
        variant={bulkGroupName ? 'warning' : 'info'}
        confirmText="Aplicar"
        isLoading={isApplyingGroup}
      />

      <ConfirmModal
        isOpen={!!groupError}
        onClose={() => setGroupError(null)}
        onConfirm={() => setGroupError(null)}
        title="No se pudo aplicar el grupo"
        message={groupError || ''}
        variant="danger"
        confirmText="Entendido"
        hideCancel
      />

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
