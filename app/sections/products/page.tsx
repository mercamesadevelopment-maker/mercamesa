'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { usePublicProducts } from './hooks/usePublicProducts';

import { Button, cn, normalizeText } from '@/src/components/Shared';
import { ProductCard } from '@/src/features/products/components/ProductCard';

export default function ProductsPage() {
  const { products, loading, error } = usePublicProducts();

  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [search, setSearch] = useState('');
  const [minPrice, setMinPrice] = useState<number | ''>('');
  const [maxPrice, setMaxPrice] = useState<number | ''>('');
  const [activeCat, setActiveCat] = useState('Todas');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'' | 'asc' | 'desc'>('');

  const ITEMS_PER_PAGE = 20;

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, minPrice, maxPrice, activeCat, sortBy]);

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
    const filtered = products.filter(p => {
      const matchSearch = normalizeText(p.catalog_products?.name).includes(normalizeText(search));
      const matchCat = activeCat === 'Todas' || p.catalog_products?.categories?.name === activeCat;

      const price = p.price_per_unit || 0;
      const matchMin = minPrice === '' || price >= minPrice;
      const matchMax = maxPrice === '' || price <= maxPrice;

      return matchSearch && matchCat && matchMin && matchMax;
    });

    const sortGroup = (items: typeof filtered) => {
      if (sortBy === 'asc') {
        return [...items].sort((a, b) =>
          (a.catalog_products?.name || '').localeCompare(b.catalog_products?.name || '')
        );
      }
      if (sortBy === 'desc') {
        return [...items].sort((a, b) =>
          (b.catalog_products?.name || '').localeCompare(a.catalog_products?.name || '')
        );
      }
      return items;
    };

    const featured = filtered.filter(p => p.is_featured);
    const rest = filtered.filter(p => !p.is_featured);

    return [...sortGroup(featured), ...sortGroup(rest)];
  }, [products, search, activeCat, minPrice, maxPrice, sortBy]);

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

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
          <div className="flex items-center gap-2 bg-white p-2 border border-mm-crd rounded-full px-4">
             <span className="text-xs font-bold text-mm-txw uppercase tracking-widest whitespace-nowrap">Ordenar:</span>
             <select 
                value={sortBy} 
                onChange={e => setSortBy(e.target.value as '' | 'asc' | 'desc')}
                className="text-xs font-bold bg-mm-gbg/50 rounded-lg p-1.5 outline-none focus:ring-1 ring-mm-g border-none cursor-pointer text-mm-txs pr-2"
             >
                <option value="">Ninguno</option>
                <option value="asc">A - Z</option>
                <option value="desc">Z - A</option>
             </select>
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
        {paginatedProducts.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
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
