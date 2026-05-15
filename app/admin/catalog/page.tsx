'use client';

import { useEffect, useState } from 'react';
import { Plus, Package, Edit2, Trash2, Store as StoreIcon, ChevronRight } from 'lucide-react';
import { Database } from '../../../types/database_generated';
import { useStoreProducts } from './hooks/useStoreProducts';
import { StoreProductModal } from './components/StoreProductModal';
import { Table } from '../../../components/ui/table/components/Table';
import { useTable } from '../../../components/ui/table/hooks/useTable';
import { Button, Badge } from '@/src/components/Shared';
import { createSupabaseBrowserClient } from '../../../lib/supabase/client';

type StoreProduct = Database['public']['Tables']['store_products']['Row'] & {
  catalog_products?: { name: string; image_url: string | null; categories?: { name: string } | null } | null;
  stores?: { name: string; marketplaces?: { name: string } | null } | null;
  measurement_units?: { abbreviation: string } | null;
};

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
  const [groupedProducts, setGroupedProducts] = useState<GroupedProduct[]>([]);

  useEffect(() => {
    fetchStoreProducts();
  }, [fetchStoreProducts]);

  // Group products by catalog_product_id
  useEffect(() => {
    const groupData = async () => {
      const groups = new Map<string, GroupedProduct>();
      const supabase = createSupabaseBrowserClient();
      
      for (const item of storeProducts) {
        const catId = item.catalog_product_id;
        if (!groups.has(catId)) {
          let signedUrl = null;
          if (item.catalog_products?.image_url) {
            const { data } = await supabase.storage.from('products').createSignedUrl(item.catalog_products.image_url, 3600);
            signedUrl = data?.signedUrl || null;
          }
          
          groups.set(catId, {
            id: catId,
            name: item.catalog_products?.name || 'Desconocido',
            cat: item.catalog_products?.categories?.name || 'Sin categoría',
            image_url: item.catalog_products?.image_url || null,
            imageSignedUrl: signedUrl,
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

      setGroupedProducts(Array.from(groups.values()));
    };

    if (storeProducts.length > 0) {
      groupData();
    } else {
      setGroupedProducts([]);
    }
  }, [storeProducts]);

  const {
    page, setPage, rowsPerPage, setRowsPerPage, sortKey, sortOrder, handleSort, paginatedData, totalPages
  } = useTable({ initialData: groupedProducts });

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
              <img src={item.imageSignedUrl} alt={item.name} className="w-full h-full object-cover" />
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
              <p className="text-xs font-bold text-mm-g leading-tight">{storeProd.stores?.name}</p>
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
        <Button size="sm" onClick={() => { setEditingProduct(null); setIsModalOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Asignar a Tienda
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
        expandableContent={renderExpandableContent}
      />

      {isModalOpen && (
        <StoreProductModal
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setEditingProduct(null); }}
          onSave={saveStoreProduct}
          initialData={editingProduct}
        />
      )}
    </div>
  );
}
