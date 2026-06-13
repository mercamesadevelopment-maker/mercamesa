import { useState, useEffect, useMemo } from 'react';
import { Offer, Product } from '@/src/types';
import { useSellerStore } from '@/app/hooks/use-seller-store';

export function useOffers() {
  const { stores, storeId, storeName, selectStore } = useSellerStore();
  const [myProducts, setMyProducts] = useState<Product[]>([]);
  const [myOffers, setMyOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newOffer, setNewOffer] = useState({
    title: '',
    desc: '',
    type: 'percentage' as 'percentage' | 'fixed',
    value: 0,
    productIds: [] as (string | number)[], // store_product_id UUIDs (will contain only 1 element)
    emoji: '🏷️',
    endDate: '',
  });

  const fetchStoreProductsAndOffers = async () => {
    if (!storeId) return;
    try {
      setLoading(true);
      const [productsRes, offersRes] = await Promise.all([
        fetch(`/api/store-products?store_id=${storeId}`),
        fetch(`/api/offers?store_id=${storeId}`)
      ]);

      let productsList: Product[] = [];
      if (productsRes.ok) {
        const prodJson = await productsRes.json();
        productsList = (prodJson.data || []).map((item: any) => ({
          id: item.id, // Store Product UUID
          plazaId: 1,
          storeId: item.store_id,
          emoji: '📦',
          image: item.imageSignedUrl || item.catalog_products?.image_url || '',
          name: item.catalog_products?.name || '',
          cat: item.catalog_products?.categories?.name || 'Varios',
          unit: item.measurement_units?.abbreviation || 'kg',
          retailPrice: Number(item.price_per_unit),
          wsPrice: Number(item.wholesale_price || item.price_per_unit * 0.8),
          ws20: Number(item.price_per_unit * 0.75),
          ws50: Number(item.price_per_unit * 0.7),
          wsMin: Number(item.wholesale_min_qty || 10),
          stock: Number(item.stock),
          minStock: Number(item.min_order_qty || 1),
          masterId: item.catalog_product_id,
          desc: item.catalog_products?.description || '',
          status: item.is_active ? 'active' : 'inactive',
        }));
        setMyProducts(productsList);
      }

      if (offersRes.ok) {
        const offersJson = await offersRes.json();
        const mappedOffers: Offer[] = (offersJson.data || []).map((item: any) => {
          const discountVal = item.discount_pct !== null 
            ? Number(item.discount_pct) 
            : (item.store_products ? Number(item.store_products.price_per_unit) - Number(item.special_price) : Number(item.special_price));
            
          return {
            id: item.id, // Offer UUID (we support string ID in Table component)
            storeId: storeId,
            plazaId: 1,
            title: item.label || 'Oferta Especial',
            desc: item.label ? '' : 'Descuento especial',
            type: item.discount_pct !== null ? 'percentage' : 'fixed',
            value: discountVal,
            productIds: [item.store_product_id],
            status: item.is_active ? 'active' : 'expired',
            endDate: item.ends_at ? item.ends_at.split('T')[0] : 'Sin límite',
            emoji: '🏷️',
          };
        });
        setMyOffers(mappedOffers);
      }
    } catch (err) {
      console.error('Error fetching offers or products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (storeId) {
      fetchStoreProductsAndOffers();
    }
  }, [storeId]);

  const handleAddOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId || !newOffer.title || newOffer.productIds.length === 0) return;

    const selectedStoreProductId = newOffer.productIds[0] as string;
    const selectedProduct = myProducts.find(p => p.id === selectedStoreProductId);
    if (!selectedProduct) return;

    // Calcular valores de descuento
    const discountPct = newOffer.type === 'percentage' ? Number(newOffer.value) : null;
    const specialPrice = newOffer.type === 'fixed' 
      ? Math.max(0, selectedProduct.retailPrice - Number(newOffer.value)) 
      : null;

    try {
      const response = await fetch('/api/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_product_id: selectedStoreProductId,
          label: newOffer.title,
          discount_pct: discountPct,
          special_price: specialPrice,
          starts_at: new Date().toISOString(),
          ends_at: newOffer.endDate ? new Date(newOffer.endDate).toISOString() : null,
          is_active: true,
        }),
      });

      if (!response.ok) throw new Error('Error al registrar la oferta');

      await fetchStoreProductsAndOffers();
      setIsModalOpen(false);
      setNewOffer({
        title: '',
        desc: '',
        type: 'percentage',
        value: 0,
        productIds: [],
        emoji: '🏷️',
        endDate: '',
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteOffer = async (id: string | number) => {
    try {
      const response = await fetch(`/api/offers/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Error al eliminar la oferta');
      await fetchStoreProductsAndOffers();
    } catch (err) {
      console.error(err);
    }
  };

  return {
    myOffers,
    myProducts,
    isModalOpen,
    setIsModalOpen,
    newOffer,
    setNewOffer,
    handleAddOffer,
    handleDeleteOffer,
    loading: loading || !storeId,
    stores,
    storeId,
    storeName,
    selectStore,
  };
}
