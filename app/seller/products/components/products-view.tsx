import React from 'react';
import { Search, Plus, Edit2, Trash2, Activity, AlertCircle, CheckCircle2, Zap, History } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';
import { useProducts } from '../hooks/use-products';
import { ProductModal } from './product-modal';
import { StockHistoryModal } from './StockHistoryModal';
import { Table } from '@/components/ui/table/components/Table';
import { useTable } from '@/components/ui/table/hooks/useTable';
import { Button, Badge } from '@/src/components/Shared';
import { fmt } from '@/src/constants';

export function ProductsView() {
  const {
    filteredProducts,
    lowStockProducts,
    lowestStockItem,
    search,
    setSearch,
    selectedStore,
    setSelectedStore,
    selectedCategory,
    setSelectedCategory,
    categories,
    isModalOpen,
    setIsModalOpen,
    editingProduct,
    newProduct,
    setNewProduct,
    catalog,
    handleOpenAdd,
    handleOpenEdit,
    handleAddProduct,
    handleDeleteProduct,
    stores,
    storeId,
    selectStore,
  } = useProducts();

  const [selectedProductForHistory, setSelectedProductForHistory] = React.useState<any | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = React.useState(false);

  const {
    page,
    setPage,
    rowsPerPage,
    setRowsPerPage,
    sortKey,
    sortOrder,
    handleSort,
    paginatedData,
    totalPages,
  } = useTable({ initialData: filteredProducts, initialRowsPerPage: 10 });

  // Columns for the shared Table
  const columns = [
    {
      key: 'name',
      label: 'Producto',
      render: (item: any) => (
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-mm-gbg rounded-xl flex items-center justify-center text-2xl overflow-hidden shrink-0 border border-mm-crd">
            {item.image ? (
              <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl">{item.emoji}</span>
            )}
          </div>
          <span className="font-bold text-mm-g">{item.name}</span>
        </div>
      )
    },
    {
      key: 'cat',
      label: 'Categoría',
      render: (item: any) => <span className="text-sm text-mm-txs">{item.cat}</span>
    },
    {
      key: 'retailPrice',
      label: 'Precio Retail',
      render: (item: any) => <span className="text-sm font-bold text-mm-g">{fmt(item.retailPrice)}</span>
    },
    {
      key: 'wsPrice',
      label: 'Precio Mayorista',
      render: (item: any) => <span className="text-sm font-bold text-blue">{fmt(item.wsPrice)}</span>
    },
    {
      key: 'stock',
      label: 'Stock',
      render: (item: any) => (
        <Badge variant={item.stock < item.minStock ? 'error' : 'success'}>
          {item.stock} {item.unit}s
        </Badge>
      )
    },
    {
      key: 'status',
      label: 'Estado',
      render: (item: any) => (
        <Badge variant={item.status === 'active' ? 'success' : 'default'}>
          {item.status === 'active' ? 'Activo' : 'Inactivo'}
        </Badge>
      )
    }
  ];

  const actions = (item: any) => (
    <div className="flex gap-2">
      <button 
        className="p-2 hover:bg-mm-gbg rounded-full text-mm-txw hover:text-mm-g transition-colors"
        onClick={() => {
          setSelectedProductForHistory(item);
          setIsHistoryOpen(true);
        }}
        title="Ver Bitácora de Inventario"
      >
        <History className="w-4 h-4" />
      </button>
      <button 
        className="p-2 hover:bg-mm-gbg rounded-full text-mm-txw hover:text-mm-g transition-colors"
        onClick={() => handleOpenEdit(item)}
      >
        <Edit2 className="w-4 h-4" />
      </button>
      <button 
        className="p-2 hover:bg-mm-gbg rounded-full text-mm-txw hover:text-r transition-colors"
        onClick={() => handleDeleteProduct(item.id)}
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-fraunces text-mm-g mb-2">Inventario</h1>
          <p className="text-mm-txs">Gestiona tus productos, precios y existencias.</p>
        </div>
        <Button onClick={handleOpenAdd} className="shadow-lg shadow-mm-g/10">
          <Plus className="w-5 h-5 mr-1" /> Agregar
        </Button>
      </div>

      {/* Filtros de Búsqueda, Tienda y Categoría */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-2xl border border-mm-crd shadow-sm animate-fade-up">
        {/* Buscador */}
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-mm-txw absolute left-4 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por producto o descripción..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-mm-crd bg-white focus:border-mm-g outline-none transition-all text-sm text-mm-g placeholder:text-mm-txw"
          />
        </div>

        {/* Tienda */}
        <div>
          <select
            value={selectedStore}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedStore(val);
              if (val) selectStore(val);
            }}
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
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Analytics Section */}
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-[40px] border border-mm-crd shadow-sm h-[400px] flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-fraunces text-mm-g flex items-center gap-2">
              Niveles de Stock <Activity className="w-5 h-5 text-mm-txw" />
            </h3>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-mm-g" />
                <span className="text-[10px] font-bold text-mm-txw uppercase tracking-wider">Suficiente</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-r" />
                <span className="text-[10px] font-bold text-mm-txw uppercase tracking-wider">Crítico</span>
              </div>
            </div>
          </div>
          <div className="flex-grow">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredProducts} margin={{ bottom: 40, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fill: '#9AA88C', fontWeight: 600 }}
                  angle={-45}
                  textAnchor="end"
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#9AA88C' }}
                />
                <Tooltip 
                  cursor={{ fill: '#F2F7EC', radius: 12 }}
                  contentStyle={{ 
                    borderRadius: '24px', 
                    border: '1px solid #E8E8DC', 
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.05), 0 8px 10px -6px rgb(0 0 0 / 0.05)',
                    padding: '16px'
                  }}
                />
                <Bar 
                  dataKey="stock" 
                  radius={[8, 8, 0, 0]} 
                  barSize={40}
                >
                  {filteredProducts.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.stock <= (entry.minStock || 10) ? '#CF3D2E' : '#2A4E12'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Stock Info Cards */}
        <div className="space-y-6">
          <div className="bg-mm-g p-8 rounded-[40px] text-white shadow-xl shadow-mm-g/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
              <Zap className="w-24 h-24" />
            </div>
            <div className="relative z-10">
              <p className="text-[10px] font-black uppercase opacity-60 tracking-widest mb-1">Stock más Bajo</p>
              {lowestStockItem ? (
                <>
                  <h4 className="text-2xl font-fraunces mb-4 truncate pr-12">
                    {lowestStockItem.name}
                  </h4>
                  <div className="flex items-end gap-2">
                    <span className="text-5xl font-bold font-fraunces tabular-nums">
                      {lowestStockItem.stock}
                    </span>
                    <span className="text-sm font-bold opacity-80 mb-2 uppercase tracking-widest">
                      {lowestStockItem.unit}s
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-sm opacity-60">Sin productos registrados</p>
              )}
            </div>
          </div>
          
          <div className="bg-white p-8 rounded-[40px] border border-mm-crd shadow-sm">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-rl text-r rounded-2xl flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-mm-txw tracking-widest leading-none mb-1">Estado Crítico</p>
                <p className="font-bold text-mm-g leading-tight">
                  {lowStockProducts.length} productos agotándose
                </p>
              </div>
            </div>
            <div className="space-y-4">
              {lowStockProducts.slice(0, 3).map(p => (
                <div key={p.id} className="flex items-center justify-between group p-3 hover:bg-mm-gbg/30 rounded-2xl transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-mm-gbg flex items-center justify-center text-xl overflow-hidden border border-mm-crd shadow-sm">
                      {p.image ? <img src={p.image} className="w-full h-full object-cover" /> : p.emoji}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-mm-g">{p.name}</p>
                      <p className="text-[9px] text-mm-txw font-black uppercase">Mín: {p.minStock || 10}</p>
                    </div>
                  </div>
                  <Badge variant="error" className="py-1 px-2 text-[10px]">{p.stock} pza</Badge>
                </div>
              ))}
              {lowStockProducts.length === 0 && (
                <div className="text-center py-6">
                  <CheckCircle2 className="w-10 h-10 text-ok/20 mx-auto mb-2" />
                  <p className="text-xs text-mm-txw font-bold italic">Todo al día</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-[40px] border border-mm-crd shadow-sm overflow-hidden">
        <Table 
          data={paginatedData}
          columns={columns}
          actions={actions}
          sortKey={sortKey}
          sortOrder={sortOrder}
          onSort={handleSort}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={setRowsPerPage}
          emptyMessage="No se encontraron productos registrados en el inventario."
        />
      </div>

      {/* Product Modal */}
      <ProductModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingProduct={editingProduct}
        catalog={catalog}
        newProduct={newProduct}
        setNewOfferProduct={setNewProduct}
        onSubmit={handleAddProduct}
      />

      {/* Stock History Modal */}
      <StockHistoryModal 
        isOpen={isHistoryOpen}
        onClose={() => {
          setIsHistoryOpen(false);
          setSelectedProductForHistory(null);
        }}
        product={selectedProductForHistory}
      />
    </div>
  );
}
