import { useState, useEffect, useMemo } from 'react';
import { Product, MasterProduct } from '@/src/types';
import { useSellerStore } from '@/app/hooks/use-seller-store';

export function useProducts() {
  const { stores, storeId, storeName, selectStore } = useSellerStore();
  const [myProducts, setMyProducts] = useState<Product[]>([]);
  const [catalog, setCatalog] = useState<MasterProduct[]>([]);
  const [units, setUnits] = useState<{ id: string; name: string; abbreviation: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [selectedStore, setSelectedStore] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  // Sync selectedStore filter with active storeId initially and on change
  useEffect(() => {
    if (storeId && !selectedStore) {
      setSelectedStore(storeId);
    }
  }, [storeId]);

  // Fetch categories for filtering dropdown
  useEffect(() => {
    fetch('/api/categories')
      .then((res) => res.json())
      .then((data) => {
        if (data.data) setCategories(data.data);
      })
      .catch((err) => console.error('Error fetching categories:', err));
  }, []);

  const [newProduct, setNewProduct] = useState({
    name: '',
    retailPrice: 0,
    stock: 0,
    unit: 'kg',
    unitId: '',
    isFeatured: false,
    emoji: '🍎',
    cat: 'Varios',
    image: '',
    masterId: '' as any, // catalog_product_id UUID
    wholesalePrice: 0,
    wholesaleMinQty: 10,
    minOrderQty: 1,
  });

  // Cargar productos de todas las tiendas asociadas al vendedor
  const fetchStoreProducts = async () => {
    if (stores.length === 0) return;
    try {
      setLoading(true);
      const promises = stores.map(store => fetch(`/api/store-products?store_id=${store.id}`));
      const responses = await Promise.all(promises);
      const jsonResults = await Promise.all(responses.map(res => {
        if (!res.ok) throw new Error('Error al cargar productos de la tienda');
        return res.json();
      }));
      
      const allItems = jsonResults.flatMap(json => json.data || []);
      
      const mapped: Product[] = allItems.map((item: any) => ({
        id: item.id,
        plazaId: 1, // Default
        storeId: item.store_id,
        emoji: getEmojiForCategory(item.catalog_products?.categories?.name),
        image: item.imageSignedUrl || item.catalog_products?.image_url || '',
        name: item.catalog_products?.name || '',
        cat: item.catalog_products?.categories?.name || 'Varios',
        categoryId: item.catalog_products?.category_id || '',
        unit: item.measurement_units?.abbreviation || 'kg',
        unitId: item.unit_id || '',
        isFeatured: Boolean(item.is_featured),
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
    } finally {
      setLoading(false);
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
            defaultUnitId: item.default_unit_id || '',
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

  // Cargar productos cada vez que la lista de tiendas cambie
  useEffect(() => {
    if (stores.length > 0) {
      fetchStoreProducts();
    }
  }, [stores]);



  const handleOpenAdd = () => {
    setEditingProduct(null);
    setNewProduct({
      name: '',
      retailPrice: 0,
      stock: 0,
      unit: 'kg',
      unitId: '',
      isFeatured: false,
      emoji: '🍎',
      cat: 'Varios',
      image: '',
      masterId: '',
      wholesalePrice: 0,
      wholesaleMinQty: 10,
      minOrderQty: 1,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setNewProduct({
      name: p.name,
      retailPrice: p.retailPrice,
      stock: p.stock,
      unit: p.unit,
      unitId: p.unitId || '',
      isFeatured: p.isFeatured || false,
      emoji: p.emoji,
      cat: p.cat,
      image: p.image || '',
      masterId: p.masterId as string,
      wholesalePrice: p.wsPrice || 0,
      wholesaleMinQty: p.wsMin || 10,
      minOrderQty: p.minStock || 1,
    });
    setIsModalOpen(true);
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId || !newProduct.masterId) return;

    // Validation to ensure wholesale price is lower than or equal to retail price
    if (newProduct.wholesalePrice > newProduct.retailPrice) {
      alert('El precio mayorista no puede ser mayor que el precio minorista.');
      return;
    }

    if (!newProduct.unitId) {
      alert('Selecciona una unidad de medida.');
      return;
    }

    try {
      if (editingProduct) {
        // Actualizar
        const response = await fetch(`/api/store-products/${editingProduct.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            unit_id: newProduct.unitId,
            price_per_unit: newProduct.retailPrice,
            stock: newProduct.stock,
            min_order_qty: newProduct.minOrderQty,
            wholesale_price: newProduct.wholesalePrice,
            wholesale_min_qty: newProduct.wholesaleMinQty,
            is_featured: newProduct.isFeatured,
          }),
        });

        if (!response.ok) {
          const errJson = await response.json().catch(() => null);
          throw new Error(errJson?.error || 'Error al actualizar producto');
        }
      } else {
        // Agregar
        const response = await fetch('/api/store-products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            catalog_product_id: newProduct.masterId,
            store_id: storeId,
            unit_id: newProduct.unitId,
            price_per_unit: newProduct.retailPrice,
            stock: newProduct.stock,
            min_order_qty: newProduct.minOrderQty,
            wholesale_price: newProduct.wholesalePrice,
            wholesale_min_qty: newProduct.wholesaleMinQty,
            is_featured: newProduct.isFeatured,
          }),
        });

        if (!response.ok) {
          const errJson = await response.json().catch(() => null);
          throw new Error(errJson?.error || 'Error al agregar producto');
        }
      }

      await fetchStoreProducts();
      setIsModalOpen(false);
      setEditingProduct(null);
      setNewProduct({
        name: '',
        retailPrice: 0,
        stock: 0,
        unit: 'kg',
        unitId: '',
        isFeatured: false,
        emoji: '🍎',
        cat: 'Varios',
        image: '',
        masterId: '',
        wholesalePrice: 0,
        wholesaleMinQty: 10,
        minOrderQty: 1,
      });
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Error al guardar el producto');
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
    return myProducts.filter((p) => {
      // 1. Search Query: matches product name or description
      const matchesSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.desc.toLowerCase().includes(search.toLowerCase());

      // 2. Store: matches store ID
      const matchesStore = !selectedStore || p.storeId === selectedStore;

      // 3. Category: matches category ID
      const matchesCategory = !selectedCategory || p.categoryId === selectedCategory;

      return matchesSearch && matchesStore && matchesCategory;
    });
  }, [myProducts, search, selectedStore, selectedCategory]);

  const lowStockProducts = useMemo(() => {
    return myProducts.filter(p => {
      const matchesStore = !selectedStore || p.storeId === selectedStore;
      const matchesCategory = !selectedCategory || p.categoryId === selectedCategory;
      return matchesStore && matchesCategory && p.stock <= (p.minStock || 10);
    });
  }, [myProducts, selectedStore, selectedCategory]);

  const lowestStockItem = useMemo(() => {
    const storeAndCatProducts = myProducts.filter(p => {
      const matchesStore = !selectedStore || p.storeId === selectedStore;
      const matchesCategory = !selectedCategory || p.categoryId === selectedCategory;
      return matchesStore && matchesCategory;
    });
    if (storeAndCatProducts.length === 0) return null;
    return [...storeAndCatProducts].sort((a, b) => a.stock - b.stock)[0];
  }, [myProducts, selectedStore, selectedCategory]);

  return {
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
    units,
    loading: loading || !storeId,
    handleOpenAdd,
    handleOpenEdit,
    handleAddProduct,
    handleDeleteProduct,
    fetchStoreProducts,
    stores,
    storeId,
    storeName,
    selectStore,
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
