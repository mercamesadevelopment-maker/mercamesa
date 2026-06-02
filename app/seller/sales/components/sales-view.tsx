import React, { useState } from 'react';
import { 
  ShoppingCart, Search, Receipt, Plus, X, ArrowUpRight, History, 
  TrendingUp, User2, Eye, LayoutGrid 
} from 'lucide-react';
import { useSales } from '../hooks/use-sales';
import { CustomerAutocomplete } from './customer-autocomplete';
import { Button, Badge } from '@/src/components/Shared';
import { Modal } from '@/components/ui/modal/modal';
import { Table } from '@/components/ui/table/components/Table';
import { fmt } from '@/src/constants';
import { Product } from '@/src/types';

export function SalesView() {
  const {
    search,
    setSearch,
    cart,
    customer,
    setCustomer,
    filteredProducts,
    addToCart,
    removeFromCart,
    toggleUnitMode,
    updateQtyValue,
    total,
    handleCheckout,
    mySales,
    todayTotal,
    nextConsecutive,
    loading,
  } = useSales();

  const [isTodaySalesOpen, setIsTodaySalesOpen] = useState(false);

  // Columnas para la tabla de ventas de hoy dentro del Modal
  const columns = [
    {
      key: 'id',
      label: 'Consecutivo',
      render: (item: any) => <span className="font-mono font-bold">#{item.id}</span>
    },
    {
      key: 'customerName',
      label: 'Cliente',
      render: (item: any) => <span>{item.customerName || 'Consumidor Final'}</span>
    },
    {
      key: 'items',
      label: 'Productos',
      render: (item: any) => (
        <span className="text-xs">
          {item.items.map((i: any) => `${i.qty}${i.unit} ${i.name}`).join(', ')}
        </span>
      )
    },
    {
      key: 'total',
      label: 'Total',
      render: (item: any) => <span className="font-bold text-mm-g">{fmt(item.total)}</span>
    }
  ];

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-fraunces text-mm-g mb-2">Ventas en Sitio</h1>
          <p className="text-mm-txs">Registra ventas rápidas desde tu local físico.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setIsTodaySalesOpen(true)}
            className="rounded-2xl border-mm-crd text-mm-g hover:bg-mm-gbg"
          >
            <History className="w-4 h-4 mr-2" />
            Ventas de Hoy ({mySales.length})
          </Button>

          <div className="flex items-center gap-4 bg-white px-6 py-2.5 rounded-2xl border border-mm-crd shadow-sm">
            <Receipt className="w-5 h-5 text-mm-oro" />
            <div>
              <p className="text-[10px] font-black uppercase text-mm-txw tracking-widest leading-none mb-1">Consecutivo</p>
              <p className="text-lg font-bold text-mm-g leading-none">#{nextConsecutive}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Products Catalog and Analytics */}
        <div className="lg:col-span-7 space-y-6">
          {/* Search and Grid Card */}
          <div className="bg-white p-6 rounded-[32px] border border-mm-crd shadow-sm space-y-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-mm-txw" />
              <input 
                type="text" 
                placeholder="Buscar por nombre o categoría..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-mm-gbg/30 border-none rounded-2xl py-4 pl-12 pr-4 text-sm outline-none focus:ring-2 ring-mm-g/20 transition-all font-medium shadow-inner"
              />
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto scrollbar-hide pr-2">
              {loading ? (
                <div className="col-span-full py-12 text-center text-mm-txw opacity-60">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mm-g mx-auto mb-2" />
                  <p className="text-sm font-medium">Cargando catálogo...</p>
                </div>
              ) : (
                <>
                  {filteredProducts.map(product => (
                    <button
                      key={product.id}
                      onClick={() => addToCart(product)}
                      className="flex flex-col p-4 bg-white border border-mm-crd rounded-2xl hover:border-mm-g hover:shadow-md transition-all group text-left relative overflow-hidden text-mm-g"
                    >
                      <div className="w-12 h-12 rounded-xl bg-mm-gbg flex items-center justify-center text-2xl mb-3 shrink-0 border border-mm-crd overflow-hidden">
                        {product.image ? (
                           <img src={product.image} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                           product.emoji
                        )}
                      </div>
                      <p className="text-sm font-bold text-mm-g leading-tight mb-1 truncate w-full">{product.name}</p>
                      <p className="text-xs font-bold text-blue font-mono">{fmt(product.retailPrice)}</p>
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-8 h-8 rounded-full bg-mm-g text-white flex items-center justify-center shadow-lg">
                          <Plus className="w-5 h-5" />
                        </div>
                      </div>
                    </button>
                  ))}
                  {filteredProducts.length === 0 && (
                    <div className="col-span-full py-12 text-center text-mm-txw opacity-60">
                      <LayoutGrid className="w-12 h-12 mx-auto mb-2" />
                      <p className="text-sm font-medium">No se encontraron productos</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-mm-gbg/20 p-6 rounded-[32px] border border-mm-crd/50 flex items-center gap-4">
               <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-mm-g">
                 <History className="w-6 h-6" />
               </div>
               <div>
                 <p className="text-2xl font-bold text-mm-g leading-none">{mySales.length}</p>
                 <p className="text-[10px] font-black uppercase text-mm-txw tracking-widest mt-1">Ventas Hoy</p>
               </div>
            </div>
            <div className="bg-mm-oro/10 p-6 rounded-[32px] border border-mm-oro/20 flex items-center gap-4">
               <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-mm-oro">
                 <TrendingUp className="w-6 h-6" />
               </div>
               <div>
                 <p className="text-2xl font-bold text-mm-g leading-none">{fmt(todayTotal)}</p>
                 <p className="text-[10px] font-black uppercase text-mm-txw tracking-widest mt-1">Total del Día</p>
               </div>
            </div>
          </div>
        </div>

        {/* Right Side: Checkout Sidebar */}
        <div className="lg:col-span-5 space-y-6">
          <form onSubmit={handleCheckout} className="bg-white rounded-[40px] border border-mm-crd shadow-xl overflow-hidden flex flex-col min-h-[600px]">
            <div className="p-8 border-b border-mm-crd flex items-center justify-between bg-mm-gbg/10">
              <h3 className="text-xl font-fraunces text-mm-g flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" /> Nueva Venta
              </h3>
              {cart.length > 0 && (
                <button 
                  type="button"
                  onClick={() => removeFromCart(cart[0].product.id)} // or vaciar
                  className="text-xs font-bold text-r hover:bg-rl px-3 py-1 rounded-full transition-colors"
                >
                  Vaciar
                </button>
              )}
            </div>

            {/* Cart Items List */}
            <div className="flex-grow p-8 overflow-y-auto max-h-[400px] scrollbar-hide space-y-4">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-20">
                  <div className="w-20 h-20 bg-mm-gbg rounded-[32px] flex items-center justify-center mb-6">
                    <ShoppingCart className="w-10 h-10 text-mm-txw" />
                  </div>
                  <p className="text-xl font-fraunces text-mm-g mb-2">Comienza tu venta</p>
                  <p className="text-sm px-10">Agrega productos del inventario para iniciar el cobro</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.product.id} className="flex items-center gap-4 group animate-in fade-in slide-in-from-right-4">
                    <div className="w-12 h-12 rounded-xl bg-mm-gbg flex items-center justify-center text-2xl shrink-0 border border-mm-crd overflow-hidden">
                      {item.product.image ? (
                        <img src={item.product.image} className="w-full h-full object-cover rounded-xl" referrerPolicy="no-referrer" />
                      ) : (
                        item.product.emoji
                      )}
                    </div>
                    <div className="flex-grow min-w-0">
                      <p className="text-sm font-bold text-mm-g truncate">{item.product.name}</p>
                      <p className="text-xs text-mm-txw font-mono">{fmt(item.product.retailPrice)}</p>
                    </div>
                    <div className="flex items-center gap-1 bg-mm-gbg/50 p-1 rounded-xl">
                      <input 
                        type="number" 
                        step={item.unitMode === 'alt' ? "1" : "0.01"}
                        min={item.unitMode === 'alt' ? "1" : "0.01"}
                        value={item.unitMode === 'alt' && item.product.unit === 'kg' ? Math.round(item.qty * 1000) : item.qty}
                        onChange={(e) => updateQtyValue(item.product.id, parseFloat(e.target.value) || 0)}
                        className="w-20 bg-white border-none rounded-lg py-1 px-2 text-xs font-bold text-center appearance-none focus:ring-1 ring-mm-g/20"
                      />
                      {item.product.unit === 'kg' ? (
                        <button
                          type="button"
                          onClick={() => toggleUnitMode(item.product.id)}
                          className="px-2 py-1 bg-white rounded-lg text-[10px] font-black uppercase text-mm-g hover:bg-mm-gll transition-colors min-w-[32px] border border-mm-crd/50"
                        >
                          {item.unitMode === 'alt' ? 'g' : 'kg'}
                        </button>
                      ) : (
                        <span className="text-[10px] font-bold text-mm-txw px-2 py-1 uppercase">{item.product.unit}</span>
                      )}
                    </div>
                    <div className="text-right min-w-[70px]">
                      <p className="text-sm font-bold text-mm-g font-mono">{fmt(item.product.retailPrice * item.qty)}</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => removeFromCart(item.product.id)}
                      className="p-1 text-mm-txw hover:text-r transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Customer Section & Checkout Footer */}
            <div className="p-8 bg-mm-gbg/20 border-t border-mm-crd space-y-6">
              {/* Autocomplete del Cliente */}
              <CustomerAutocomplete value={customer} onChange={setCustomer} />

              <div className="space-y-3 pt-4 border-t border-mm-crd/50">
                <div className="flex justify-between items-center text-mm-g">
                  <span className="text-sm font-bold">Total a Cobrar</span>
                  <span className="text-3xl font-fraunces tabular-nums">{fmt(total)}</span>
                </div>
              </div>

              <Button 
                type="submit" 
                size="lg" 
                className="w-full py-7 text-lg shadow-xl shadow-mm-g/20 disabled:opacity-50 transition-all"
                disabled={cart.length === 0}
              >
                Registrar Venta <ArrowUpRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* MODAL COMPARTIDO: Ventas de Hoy */}
      <Modal 
        isOpen={isTodaySalesOpen} 
        onClose={() => setIsTodaySalesOpen(false)} 
        title="Ventas Registradas Hoy"
      >
        <div className="p-6">
          <Table 
            data={mySales}
            columns={columns}
            emptyMessage="No se han registrado ventas físicas hoy."
          />
        </div>
      </Modal>
    </div>
  );
}
