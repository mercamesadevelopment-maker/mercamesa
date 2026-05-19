'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Search, ShoppingCart, ChevronLeft, ChevronRight } from 'lucide-react';
import { usePublicProducts } from './hooks/usePublicProducts';
import { Badge, Button, cn } from '@/src/components/Shared';
import { useApp } from '@/src/store';

export default function ProductsPage() {
  const { products, loading, error } = usePublicProducts();
  const { dispatch } = useApp();
  
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [search, setSearch] = useState('');
  const [minPrice, setMinPrice] = useState<number | ''>('');
  const [maxPrice, setMaxPrice] = useState<number | ''>('');
  const [activeCat, setActiveCat] = useState('Todas');
  const [currentPage, setCurrentPage] = useState(1);

  const ITEMS_PER_PAGE = 20;

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, minPrice, maxPrice, activeCat]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach(p => {
      if (p.catalog_products?.categories?.name) {
        cats.add(p.catalog_products.categories.name);
      }
    });
    return ['Todas', ...Array.from(cats)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch = p.catalog_products?.name?.toLowerCase().includes(search.toLowerCase()) || false;
      const matchCat = activeCat === 'Todas' || p.catalog_products?.categories?.name === activeCat;
      
      const price = p.price_per_unit || 0;
      const matchMin = minPrice === '' || price >= minPrice;
      const matchMax = maxPrice === '' || price <= maxPrice;

      return matchSearch && matchCat && matchMin && matchMax;
    });
  }, [products, search, activeCat, minPrice, maxPrice]);

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleAddToCart = (e: React.MouseEvent, p: any) => {
    e.stopPropagation();
    dispatch({
      type: 'ADD_TO_CART',
      product: {
        id: p.id,
        name: p.catalog_products?.name || 'Producto',
        cat: p.catalog_products?.categories?.name || 'Sin Categoría',
        retailPrice: p.price_per_unit || 0,
        wsPrice: p.price_per_unit || 0,
        stock: 100, // mock
        unit: p.measurement_units?.abbreviation || 'und',
        emoji: '📦',
        image: p.imageSignedUrl || null,
        plazaId: 1, // mock if needed
        storeId: p.store_id || 1,
        storeName: p.stores?.name || 'Tienda'
      } as any
    });
  };

  const fmt = (val: number) => `$${val.toLocaleString('es-CO')}`;

  const scroll = (offset: number) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-mm-txs">Cargando productos...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-r">{error}</div>;
  }

  return (
    <div className="p-4 sm:p-8 space-y-8 pb-32">
      <div>
        <h1 className="text-4xl font-fraunces text-mm-g mb-2">Todos los Productos</h1>
        <p className="text-mm-txs">Lo mejor del campo en un solo lugar.</p>
      </div>

      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="relative flex-grow">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-mm-txw" />
            <input 
              type="text" 
              placeholder="¿Qué buscas hoy?" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-mm-crd rounded-full py-2.5 pl-11 pr-4 text-sm outline-none focus:border-mm-g transition-all"
            />
          </div>
          <div className="flex items-center gap-4 bg-white p-2 border border-mm-crd rounded-full px-4">
             <span className="text-xs font-bold text-mm-txw uppercase tracking-widest whitespace-nowrap">Precio:</span>
             <input 
                type="number" 
                value={minPrice} 
                onChange={e => setMinPrice(e.target.value ? Number(e.target.value) : '')}
                className="w-20 text-xs font-bold bg-mm-gbg/50 rounded-lg p-1.5 outline-none focus:ring-1 ring-mm-g"
                placeholder="Min"
             />
             <span className="text-mm-txw">-</span>
             <input 
                type="number" 
                value={maxPrice} 
                onChange={e => setMaxPrice(e.target.value ? Number(e.target.value) : '')}
                className="w-20 text-xs font-bold bg-mm-gbg/50 rounded-lg p-1.5 outline-none focus:ring-1 ring-mm-g"
                placeholder="Max"
             />
          </div>
        </div>
        
        <div className="relative group flex items-center">
          <button 
            onClick={() => scroll(-200)}
            className="absolute left-0 z-10 p-2 bg-white/80 backdrop-blur-sm rounded-full shadow-md text-mm-txs hover:text-mm-g opacity-0 group-hover:opacity-100 transition-opacity -ml-4"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div ref={scrollRef} className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide flex-grow px-2">
            {categories.map(c => (
              <button
                key={c}
                onClick={() => setActiveCat(c)}
                className={cn(
                  "px-5 py-2.5 rounded-full text-sm font-bold transition-all whitespace-nowrap",
                  activeCat === c ? "bg-mm-g text-white shadow-md" : "bg-white border border-mm-crd text-mm-txs hover:border-mm-g"
                )}
              >
                {c}
              </button>
            ))}
          </div>

          <button 
            onClick={() => scroll(200)}
            className="absolute right-0 z-10 p-2 bg-white/80 backdrop-blur-sm rounded-full shadow-md text-mm-txs hover:text-mm-g opacity-0 group-hover:opacity-100 transition-opacity -mr-4"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
        {paginatedProducts.map(product => {
          return (
            <motion.div
              key={product.id}
              whileHover={{ y: -5 }}
              className="bg-white rounded-[28px] border border-mm-crd shadow-sm hover:shadow-xl transition-all overflow-hidden flex flex-col group border-b-4 border-b-mm-crd hover:border-b-mm-g duration-200"
            >
              <div className="h-40 bg-mm-gbg flex items-center justify-center text-5xl relative overflow-hidden">
                {product.imageSignedUrl ? (
                  <img src={product.imageSignedUrl} alt={product.catalog_products?.name || 'Producto'} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                ) : (
                  <span className="group-hover:scale-125 transition-transform duration-500">📦</span>
                )}
              </div>
              <div className="p-4 flex flex-col flex-grow">
                <div className="flex-grow">
                  <p className="text-[10px] text-mm-txw font-bold uppercase tracking-tighter mb-1 line-clamp-1">{product.stores?.name}</p>
                  <h3 className="font-bold text-mm-g mb-0.5 line-clamp-1 group-hover:text-mm-oro transition-colors text-sm sm:text-base">{product.catalog_products?.name}</h3>
                  <p className="text-[10px] text-mm-txw mb-3 font-medium uppercase tracking-widest">{product.catalog_products?.categories?.name}</p>
                </div>
                
                <div className="flex items-center justify-between pt-1 border-t border-mm-crd/50 gap-2">
                  <div className="flex flex-col">
                    <p className="font-bold text-mm-g text-lg sm:text-xl tracking-tight leading-none">
                      {fmt(product.price_per_unit || 0)}
                    </p>
                    <p className="text-[9px] text-mm-txs font-bold uppercase tracking-wider mt-0.5">
                      / {product.measurement_units?.abbreviation}
                    </p>
                  </div>
                  <button 
                    onClick={(e) => handleAddToCart(e, product)}
                    className="w-10 h-10 sm:w-12 sm:h-12 bg-mm-g text-white rounded-2xl flex items-center justify-center hover:bg-mm-oro hover:-translate-y-1 hover:shadow-lg transition-all active:scale-95 shrink-0"
                  >
                    <ShoppingCart className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
        {filteredProducts.length === 0 && (
          <div className="col-span-full py-12 text-center text-mm-txw">
            No se encontraron productos con estos filtros.
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 pt-8">
          <Button 
            variant="outline" 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="w-10 h-10 p-0 rounded-full flex items-center justify-center"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <span className="text-sm font-bold text-mm-txs">
            Página {currentPage} de {totalPages}
          </span>
          <Button 
            variant="outline" 
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="w-10 h-10 p-0 rounded-full flex items-center justify-center"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      )}
    </div>
  );
}
