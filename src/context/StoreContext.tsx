import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { Product, Banner, Category, StoreSettings } from '../types';
import {
  subscribeProducts,
  subscribeBanners,
  subscribeCategories,
  subscribeSettings,
  recordProductClick,
  saveProduct,
  deleteProduct,
  updateProductField,
  batchUpdateProductOrders,
  saveBanner,
  deleteBanner,
  batchUpdateBannerOrders,
  saveCategory,
  deleteCategory,
  saveSettings,
  sortProductList,
} from '../lib/firestoreService';
import {
  DEFAULT_SETTINGS,
  DEFAULT_CATEGORIES,
  DEFAULT_BANNERS,
  DEFAULT_PRODUCTS,
} from '../lib/defaultData';
import { useAuth } from './AuthContext';

interface StoreContextType {
  // Public Data
  publicProducts: Product[];
  activeBanners: Banner[];
  categories: Category[];
  settings: StoreSettings;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  loading: boolean;
  onProductClick: (product: Product) => void;

  // Admin Data & Operations
  allProducts: Product[];
  allBanners: Banner[];
  allCategories: Category[];
  saveProductAction: (product: Partial<Product> & { id?: string }) => Promise<string>;
  deleteProductAction: (id: string) => Promise<void>;
  toggleActiveAction: (id: string, current: boolean) => Promise<void>;
  togglePinAction: (id: string, current: boolean) => Promise<void>;
  toggleFeaturedAction: (id: string, current: boolean) => Promise<void>;
  reorderProductsAction: (newList: Product[]) => Promise<void>;
  saveBannerAction: (banner: Partial<Banner> & { id?: string }) => Promise<string>;
  deleteBannerAction: (id: string) => Promise<void>;
  reorderBannersAction: (newList: Banner[]) => Promise<void>;
  saveCategoryAction: (cat: Partial<Category> & { id?: string }) => Promise<string>;
  deleteCategoryAction: (id: string) => Promise<void>;
  saveSettingsAction: (settings: StoreSettings) => Promise<void>;

  // Toast
  toastMessage: string | null;
  showToast: (msg: string) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.isAdmin);

  const [products, setProducts] = useState<Product[]>(DEFAULT_PRODUCTS);
  const [banners, setBanners] = useState<Banner[]>(DEFAULT_BANNERS);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState<boolean>(true);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Subscribe to Firestore / Local state
  useEffect(() => {
    setLoading(true);
    let loadedCount = 0;
    const checkAllLoaded = () => {
      loadedCount++;
      if (loadedCount >= 4) {
        setLoading(false);
      }
    };

    // Safety fallback timeout: if Firestore connection takes too long or operates in offline mode,
    // ensure loading spinner does not block the UI indefinitely.
    const safetyTimeout = setTimeout(() => {
      setLoading(false);
    }, 1500);

    const unsubProducts = subscribeProducts((prods) => {
      setProducts(prods);
      checkAllLoaded();
    }, isAdmin);

    const unsubBanners = subscribeBanners((bans) => {
      setBanners(bans);
      checkAllLoaded();
    }, isAdmin);

    const unsubCategories = subscribeCategories((cats) => {
      setCategories(cats);
      checkAllLoaded();
    }, isAdmin);

    const unsubSettings = subscribeSettings((sett) => {
      setSettings(sett);
      checkAllLoaded();
    });

    return () => {
      clearTimeout(safetyTimeout);
      unsubProducts();
      unsubBanners();
      unsubCategories();
      unsubSettings();
    };
  }, [isAdmin]);

  // Handle Product Redirection & Click Tracking
  const onProductClick = (product: Product) => {
    // If affiliateUrl is specified and non-empty, redirect to it; otherwise fallback to main amazonUrl
    const targetUrl = product.affiliateUrl?.trim() || product.amazonUrl?.trim();
    if (!targetUrl) return;

    // Fire-and-forget atomic click tracking
    recordProductClick(product.id).catch((err) =>
      console.error('Failed to increment click count:', err)
    );

    // Optimistically update local click count in UI if visible in admin
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, clickCount: (p.clickCount || 0) + 1 } : p))
    );

    // Safe redirection with noopener, noreferrer
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  // Filter public products: ONLY active === true
  const publicProducts = useMemo(() => {
    let filtered = products.filter((p) => p.active);

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(
        (p) =>
          p.category.toLowerCase() === selectedCategory.toLowerCase() ||
          p.category.toLowerCase().replace(/[^a-z0-9]/g, '-') === selectedCategory.toLowerCase()
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          (p.asin && p.asin.toLowerCase().includes(q)) ||
          p.category.toLowerCase().includes(q)
      );
    }

    return sortProductList(filtered);
  }, [products, selectedCategory, searchQuery]);

  // Active banners for public showcase (filtered by active & scheduled dates if set)
  const activeBanners = useMemo(() => {
    const now = new Date();
    return banners
      .filter((b) => {
        if (!b.active) return false;
        if (b.startDate && new Date(b.startDate) > now) return false;
        if (b.endDate && new Date(b.endDate) < now) return false;
        return true;
      })
      .sort((a, b) => a.order - b.order);
  }, [banners]);

  // Admin Actions
  const saveProductAction = async (product: Partial<Product> & { id?: string }) => {
    const id = await saveProduct(product);
    showToast('Product saved successfully');
    return id;
  };

  const deleteProductAction = async (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    await deleteProduct(id);
    showToast('Product deleted');
  };

  const toggleActiveAction = async (id: string, current: boolean) => {
    await updateProductField(id, { active: !current });
    showToast(current ? 'Product hidden from public view' : 'Product is now visible publicly');
  };

  const togglePinAction = async (id: string, current: boolean) => {
    await updateProductField(id, { pinned: !current });
    showToast(current ? 'Product unpinned' : 'Product pinned to top of catalog');
  };

  const toggleFeaturedAction = async (id: string, current: boolean) => {
    await updateProductField(id, { featured: !current });
    showToast(current ? 'Removed from featured section' : 'Added to featured section');
  };

  const reorderProductsAction = async (newList: Product[]) => {
    setProducts(newList);
    await batchUpdateProductOrders(newList);
    showToast('Product order saved');
  };

  const saveBannerAction = async (banner: Partial<Banner> & { id?: string }) => {
    const id = await saveBanner(banner);
    showToast('Banner saved successfully');
    return id;
  };

  const deleteBannerAction = async (id: string) => {
    setBanners((prev) => prev.filter((b) => b.id !== id));
    await deleteBanner(id);
    showToast('Banner deleted');
  };

  const reorderBannersAction = async (newList: Banner[]) => {
    setBanners(newList);
    await batchUpdateBannerOrders(newList);
    showToast('Banner order saved');
  };

  const saveCategoryAction = async (cat: Partial<Category> & { id?: string }) => {
    const id = await saveCategory(cat);
    showToast('Category saved');
    return id;
  };

  const deleteCategoryAction = async (id: string) => {
    await deleteCategory(id);
    showToast('Category deleted');
  };

  const saveSettingsAction = async (newSettings: StoreSettings) => {
    await saveSettings(newSettings);
    setSettings(newSettings);
    showToast('Store settings updated');
  };

  return (
    <StoreContext.Provider
      value={{
        publicProducts,
        activeBanners,
        categories: categories.filter((c) => c.active),
        settings,
        selectedCategory,
        setSelectedCategory,
        searchQuery,
        setSearchQuery,
        loading,
        onProductClick,

        allProducts: products,
        allBanners: banners,
        allCategories: categories,
        saveProductAction,
        deleteProductAction,
        toggleActiveAction,
        togglePinAction,
        toggleFeaturedAction,
        reorderProductsAction,
        saveBannerAction,
        deleteBannerAction,
        reorderBannersAction,
        saveCategoryAction,
        deleteCategoryAction,
        saveSettingsAction,

        toastMessage,
        showToast,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return ctx;
};
