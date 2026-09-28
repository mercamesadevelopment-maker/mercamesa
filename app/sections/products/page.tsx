'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import {
  usePublicProducts,
  useVitrinaCategorias,
  CONSULTA_INICIAL,
  type VitrinaQuery,
} from './hooks/usePublicProducts';
import { CategoryScroller } from '@/components/ui/category-scroller';

import { Button, normalizeText } from '@/src/components/Shared';
import { ProductCard } from '@/src/features/products/components/ProductCard';

/** Lo que muestra el selector, y cómo se traduce a lo que entiende el servidor. */
type OrdenUI = '' | 'asc' | 'desc' | 'price_asc' | 'price_desc';

const ORDEN: Record<Exclude<OrdenUI, ''>, { sort: 'name' | 'price'; dir: 'asc' | 'desc' }> = {
  asc: { sort: 'name', dir: 'asc' },
  desc: { sort: 'name', dir: 'desc' },
  price_asc: { sort: 'price', dir: 'asc' },
  price_desc: { sort: 'price', dir: 'desc' },
};

const ITEMS_PER_PAGE = 20;

export default function ProductsPage() {
  const { products, total, loading, error, fetchProducts } = usePublicProducts();
  const categorias = useVitrinaCategorias();

  const [search, setSearch] = useState('');
  const [minPrice, setMinPrice] = useState<number | ''>('');
  const [maxPrice, setMaxPrice] = useState<number | ''>('');
  const [activeCat, setActiveCat] = useState('Todas');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<OrdenUI>('');

  /**
   * El cargando de pantalla completa solo la primera vez.
   *
   * Con la búsqueda contra el servidor, cada tecla dispara una petición; si la
   * página se reemplazara por "Cargando productos...", el input se desmontaría y
   * perdería el foco a la primera letra.
   */
  const yaCargoUnaVez = useRef(false);
  if (!loading) yaCargoUnaVez.current = true;

  // Cualquier filtro nuevo devuelve a la primera página: quedarse en la 7 de una
  // búsqueda que ahora tiene 2 páginas mostraría un vacío.
  useEffect(() => {
    setCurrentPage(1);
  }, [search, minPrice, maxPrice, activeCat, sortBy]);

  useEffect(() => {
    const orden = sortBy ? ORDEN[sortBy] : null;
    const query: VitrinaQuery = {
      ...CONSULTA_INICIAL,
      page: currentPage,
      pageSize: ITEMS_PER_PAGE,
      // El servidor compara contra `search_text`, que la base guarda en
      // minúscula y sin tildes; el término tiene que ir igual.
      search: normalizeText(search),
      category: activeCat === 'Todas' ? '' : activeCat,
      minPrice,
      maxPrice,
      sort: orden?.sort ?? null,
      dir: orden?.dir ?? 'asc',
    };

    // Se espera a que deje de escribir: sin esto sale una petición por tecla.
    const t = setTimeout(() => fetchProducts(query), 350);
    return () => clearTimeout(t);
  }, [search, minPrice, maxPrice, activeCat, sortBy, currentPage, fetchProducts]);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  if (loading && !yaCargoUnaVez.current) {
    return <div className="p-8 text-center text-mm-txs">Cargando productos...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-r">{error}</div>;
  }

  return (
    <div className="p-4 sm:p-8 space-y-8 pb-32">
      <div>
        <h1 className="text-4xl font-fraunces text-mm-g mb-2">Todos los Productos</h1>
        <p className="text-mm-txs">Conectamos el sistema alimentario.</p>
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
            {loading && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-mm-txw" />
            )}
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
              onChange={e => setSortBy(e.target.value as OrdenUI)}
              className="text-xs font-bold bg-mm-gbg/50 rounded-lg p-1.5 outline-none focus:ring-1 ring-mm-g border-none cursor-pointer text-mm-txs pr-2"
            >
              <option value="">Ninguno</option>
              <option value="asc">A - Z</option>
              <option value="desc">Z - A</option>
              <option value="price_asc">Precio: menor a mayor</option>
              <option value="price_desc">Precio: mayor a menor</option>
            </select>
          </div>
        </div>

        <CategoryScroller
          categories={['Todas', ...categorias]}
          activeCategory={activeCat}
          onSelect={setActiveCat}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
        {products.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
        {!loading && products.length === 0 && (
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
