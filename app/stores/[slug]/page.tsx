'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Search } from 'lucide-react';
import { normalizeText } from '@/src/components/Shared';
import {
  usePublicProducts,
  useVitrinaCategorias,
  fetchProductoCompartido,
  CONSULTA_INICIAL,
  type StoreProduct,
} from '@/app/sections/products/hooks/usePublicProducts';
import { useApp } from '@/src/store';
import { useFavorites } from '@/src/features/favorites/hooks/use-favorites';
import { ProductCard } from '@/src/features/products/components/ProductCard';
import { useStoreReviews } from '@/src/features/stores/hooks/use-store-reviews';
import { RatingModal } from '@/src/features/stores/components/RatingModal';
import { ReviewsPanel } from '@/src/features/stores/components/ReviewsPanel';
import { StoreHeader } from '@/src/features/stores/components/StoreHeader';
import { Pagination } from '@/app/orders/components/Pagination';
import { CategoryScroller } from '@/components/ui/category-scroller';

const PRODUCTS_PER_PAGE = 20;

export default function StoreDetailPage() {
  const { slug } = useParams();
  const router = useRouter();
  const { state } = useApp();
  const { isFavorite, toggleFavorite, fetchFavoriteIds } = useFavorites();

  const [store, setStore] = useState<any>(null);
  const [loadingStore, setLoadingStore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Los productos se piden solo cuando ya se sabe de qué tienda son. Sin el
  // `enabled`, el primer render pedía el catálogo completo del marketplace y esa
  // respuesta terminaba pisando la filtrada: la página mostraba productos de
  // otras tiendas.
  const storeId = store?.id;
  const {
    products,
    total,
    loading: loadingProducts,
    fetchProducts,
  } = usePublicProducts(storeId, { enabled: Boolean(storeId) });

  // Las categorías ya no salen de los productos cargados: con la paginación
  // contra el servidor solo se verían las de la página actual.
  const categories = useVitrinaCategorias(storeId, Boolean(storeId));

  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState('Todas');
  const [page, setPage] = useState(1);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [isReviewsPanelOpen, setIsReviewsPanelOpen] = useState(false);

  // Producto al que apunta un link compartido (`?product=<id>`): se lee de
  // `window`, igual que `app/page.tsx`, para no meter `useSearchParams` y el
  // `Suspense` que exige en una página que hoy no lo necesita para nada más.
  const [highlightProductId, setHighlightProductId] = useState<string | null>(null);
  // Solo se salta de página/filtros una vez: si no, cada re-render con el
  // producto encontrado volvería a pisar lo que la persona ya esté navegando.
  const highlightAppliedRef = useRef(false);

  useEffect(() => {
    const productParam = new URLSearchParams(window.location.search).get('product');
    if (productParam) setHighlightProductId(productParam);
  }, []);

  const { reviews, myReview, submitReview, fetchReviews } = useStoreReviews(storeId);

  const fetchDetail = async () => {
    if (!slug) return;
    try {
      setLoadingStore(true);
      const res = await fetch(`/api/stores/detail/${slug}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setStore(data.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error fetching store details');
    } finally {
      setLoadingStore(false);
    }
  };

  useEffect(() => {
    fetchDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    if (state.isLoggedIn) fetchFavoriteIds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isLoggedIn]);

  useEffect(() => {
    if (storeId) fetchReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const handleSaveReview = async (data: { stars: number; comment: string }) => {
    if (!storeId) return;
    const ok = await submitReview(storeId, data);
    if (ok) fetchDetail(); // refresca reputation_score con el nuevo promedio
  };

  // Esta página es de UNA tienda: cualquier producto de otra que llegue en la
  // respuesta se descarta acá. El servidor ya filtra por `store_id`, pero
  // mostrar el catálogo de otra tienda —con sus fotos— es justo lo que se
  // reportó, así que el filtro se deja como red de seguridad.
  const storeProducts = useMemo(
    () => (storeId ? products.filter((p) => p.store_id === storeId) : []),
    [products, storeId]
  );

  useEffect(() => {
    setPage(1);
  }, [search, activeCat]);

  useEffect(() => {
    if (!storeId) return;

    const t = setTimeout(
      () =>
        fetchProducts({
          ...CONSULTA_INICIAL,
          page,
          pageSize: PRODUCTS_PER_PAGE,
          // El servidor compara contra `search_text`, que la base guarda en
          // minúscula y sin tildes; el término tiene que ir igual.
          search: normalizeText(search),
          category: activeCat === 'Todas' ? '' : activeCat,
        }),
      350
    );
    return () => clearTimeout(t);
  }, [storeId, page, search, activeCat, fetchProducts]);

  /**
   * El producto de un enlace compartido se pide aparte y se muestra arriba.
   *
   * Antes se saltaba a la página donde caía, contando su posición dentro de la
   * lista completa. Paginando contra el servidor esa lista ya no está en el
   * navegador, y rehacer la posición exigiría reproducir en SQL un orden de tres
   * claves. Mostrarlo de primero llega al mismo sitio —que la persona vea el
   * producto que le compartieron— y además funciona con cualquier filtro puesto.
   */
  const [productoCompartido, setProductoCompartido] = useState<StoreProduct | null>(null);

  useEffect(() => {
    if (!highlightProductId || !storeId || highlightAppliedRef.current) return;
    highlightAppliedRef.current = true;

    fetchProductoCompartido(highlightProductId, storeId).then(setProductoCompartido);
  }, [highlightProductId, storeId]);

  // Si además cayó en la página que se está viendo, no se pinta dos veces.
  const productosVisibles = useMemo(() => {
    if (!productoCompartido) return storeProducts;
    return [productoCompartido, ...storeProducts.filter((p) => p.id !== productoCompartido.id)];
  }, [productoCompartido, storeProducts]);

  const totalPages = Math.ceil(total / PRODUCTS_PER_PAGE);

  // El promedio sale de las reseñas mismas: `reputation_score || 5.0` mostraba
  // un 5.0 que nadie había dado.
  const rating = useMemo(
    () => (reviews.length ? reviews.reduce((acc, r) => acc + Number(r.stars), 0) / reviews.length : null),
    [reviews]
  );

  if (loadingStore) return <div className="p-12 text-center text-mm-txs">Cargando tienda...</div>;
  if (error || !store) return <div className="p-12 text-center text-r">{error || 'No encontrada'}</div>;

  return (
    <div className="px-4 lg:px-8 max-w-7xl mx-auto py-8 animate-fade-up pb-24">
      <button 
        onClick={() => router.push('/sections/stores')}
        className="flex items-center gap-2 text-mm-g font-bold mb-6 hover:translate-x-1 transition-transform"
      >
        <ArrowLeft className="w-5 h-5" /> Volver a tiendas
      </button>

      <StoreHeader
        store={store}
        rating={rating}
        reviewCount={reviews.length}
        hasMyReview={Boolean(myReview)}
        isLoggedIn={state.isLoggedIn}
        isFavorite={isFavorite(store.id)}
        onToggleFavorite={() => toggleFavorite(store.id)}
        onRate={() => setIsRatingModalOpen(true)}
        onOpenReviews={() => setIsReviewsPanelOpen(true)}
      />

      {/* Store Products */}
      <div className="mb-8">
        <h2 className="text-2xl font-fraunces text-mm-g mb-6">Catálogo de Productos</h2>
        
        <div className="space-y-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-grow">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-mm-txw" />
              <input 
                type="text" 
                placeholder="¿Qué estás buscando en esta tienda?" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white border border-mm-crd rounded-full py-2.5 pl-11 pr-4 text-sm outline-none focus:border-mm-g transition-all"
              />
            </div>
          </div>
          
          <CategoryScroller
            categories={['Todas', ...categories]}
            activeCategory={activeCat}
            onSelect={setActiveCat}
          />
        </div>

        {loadingProducts ? (
          <div className="py-12 text-center text-mm-txs">Cargando productos...</div>
        ) : productosVisibles.length > 0 ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
              {productosVisibles.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  highlighted={product.id === highlightProductId}
                />
              ))}
            </div>
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        ) : (
          <div className="py-12 bg-mm-gbg/30 rounded-3xl border border-mm-crd text-center text-mm-txw">
            No se encontraron productos con los filtros seleccionados.
          </div>
        )}
      </div>

      <RatingModal
        isOpen={isRatingModalOpen}
        storeId={storeId || null}
        storeName={store.name}
        initialStars={myReview?.stars ?? 5}
        initialComment={myReview?.comment ?? ''}
        onClose={() => setIsRatingModalOpen(false)}
        onSave={handleSaveReview}
      />

      <ReviewsPanel
        isOpen={isReviewsPanelOpen}
        onClose={() => setIsReviewsPanelOpen(false)}
        reviews={reviews}
      />
    </div>
  );
}
