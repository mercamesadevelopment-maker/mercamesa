import { useState, useEffect, useMemo } from 'react';
import { Product, MasterProduct } from '@/src/types';
import { useSellerStore } from '@/app/hooks/use-seller-store';

export function useProducts() {
  const { storeId, storeName } = useSellerStore();
  const [myProducts, setMyProducts] = useState<Product[]>([]);
  const [catalog, setCatalog] = useState<MasterProduct[]>([]);
  const [units, setUnits] = useState<{ id: string; name: string; abbreviation: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [newProduct, setNewProduct] = useState({
    name: '',
    retailPrice: 0,
    stock: 0,
    unit: 'kg',
    emoji: '🍎',
    cat: 'Varios',
    image: '',
    masterId: '' as any, // catalog_product_id UUID
  });

  // Cargar productos de la tienda
  const fetchStoreProducts = async () => {
    if (!storeId) return;
    try {
      const response = await fetch(`/api/store-products?store_id=${storeId}`);
      if (!response.ok) throw new Error('Error al cargar productos de la tienda');
      const json = await response.json();
      
      const mapped: Product[] = (json.data || []).map((item: any) => ({
        id: item.id,
        plazaId: 1, // Default
        storeId: item.store_id,
        emoji: getEmojiForCategory(item.catalog_products?.categories?.name),
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
      setMyProducts(mapped);
    } catch (err) {
      console.error(err);
    }
  };

  // Cargar catálogo de productos maestros y unidades de medida
  useEffect(() => {
    const fetchCatalogAndUnits = async () => {
      try {
        setLoading(true);
        const [catRes, unitsRes] = await Promise.all([
          fetch('/api/products'),
          fetch('/api/measurement-units'),
        ]);

        if (catRes.ok) {
          const catJson = await catRes.json();
          const mappedCat: MasterProduct[] = (catJson.data || []).map((item: any) => ({
            id: item.id,
            name: item.name,
            cat: item.categories?.name || 'Varios',
            emoji: getEmojiForCategory(item.categories?.name),
            image: item.image_url || '',
            defaultUnit: item.measurement_units?.abbreviation || 'kg',
          }));
          setCatalog(mappedCat);
        }

        if (unitsRes.ok) {
          const unitsJson = await unitsRes.json();
          setUnits(unitsJson.data || []);
        }
      } catch (err) {
        console.error('Error fetching catalog or units:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCatalogAndUnits();
  }, []);

  // Cargar productos cada vez que storeId cambie
  useEffect(() => {
    if (storeId) {
      fetchStoreProducts();
    }
  }, [storeId]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewProduct(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setNewProduct({ name: '', retailPrice: 0, stock: 0, unit: 'kg', emoji: '🍎', cat: 'Varios', image: '', masterId: '' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setNewProduct({
      name: p.name,
      retailPrice: p.retailPrice,
      stock: p.stock,
      unit: p.unit,
      emoji: p.emoji,
      cat: p.cat,
      image: p.image || '',
      masterId: p.masterId as string
    });
    setIsModalOpen(true);
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId || !newProduct.masterId) return;

    // Buscar el unit_id que corresponde a la abreviatura de la unidad seleccionada
    const matchedMaster = catalog.find(c => c.id === newProduct.masterId);
    
    // Obtener catálogo original para sacar default_unit_id si está disponible
    const rawResponse = await fetch('/api/products');
    const rawJson = await rawResponse.json();
    const rawCatalogProduct = rawJson.data?.find((x: any) => x.id === newProduct.masterId);
    
    const unitId = rawCatalogProduct?.default_unit_id || units[0]?.id;

    try {
      if (editingProduct) {
        // Actualizar
        const response = await fetch(`/api/store-products/${editingProduct.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            price_per_unit: newProduct.retailPrice,
            stock: newProduct.stock,
            wholesale_price: Math.floor(newProduct.retailPrice * 0.8),
            wholesale_min_qty: 10,
          }),
        });

        if (!response.ok) throw new Error('Error al actualizar producto');
      } else {
        // Agregar
        const response = await fetch('/api/store-products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            catalog_product_id: newProduct.masterId,
            store_id: storeId,
            unit_id: unitId,
            price_per_unit: newProduct.retailPrice,
            stock: newProduct.stock,
            wholesale_price: Math.floor(newProduct.retailPrice * 0.8),
            wholesale_min_qty: 10,
          }),
        });

        if (!response.ok) throw new Error('Error al agregar producto');
      }

      await fetchStoreProducts();
      setIsModalOpen(false);
      setEditingProduct(null);
      setNewProduct({ name: '', retailPrice: 0, stock: 0, unit: 'kg', emoji: '🍎', cat: 'Varios', image: '', masterId: '' });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteProduct = async (productId: string | number) => {
    try {
      const response = await fetch(`/api/store-products/${productId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Error al eliminar producto');
      await fetchStoreProducts();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredProducts = useMemo(() => {
    return myProducts.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  }, [myProducts, search]);

  const lowStockProducts = useMemo(() => {
    return myProducts.filter(p => p.stock <= (p.minStock || 10));
  }, [myProducts]);

  const lowestStockItem = useMemo(() => {
    if (myProducts.length === 0) return null;
    return [...myProducts].sort((a, b) => a.stock - b.stock)[0];
  }, [myProducts]);

  return {
    filteredProducts,
    lowStockProducts,
    lowestStockItem,
    search,
    setSearch,
    isModalOpen,
    setIsModalOpen,
    editingProduct,
    newProduct,
    setNewProduct,
    catalog,
    loading: loading || !storeId,
    handleImageUpload,
    handleOpenAdd,
    handleOpenEdit,
    handleAddProduct,
    handleDeleteProduct,
  };
}

function getEmojiForCategory(catName?: string): string {
  if (!catName) return '📦';
  const name = catName.toLowerCase();
  if (name.includes('fruta')) return '🍋';
  if (name.includes('verdura') || name.includes('hortaliza')) return '🍅';
  if (name.includes('especias') || name.includes('ají') || name.includes('ajo')) return '🧄';
  if (name.includes('granos') || name.includes('arroz') || name.includes('maíz')) return '🌽';
  if (name.includes('carne') || name.includes('embutido')) return '🥩';
  if (name.includes('lácteo')) return '🥛';
  return '📦';
}
