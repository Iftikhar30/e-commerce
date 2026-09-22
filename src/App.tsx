import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { StoreProvider, useStore } from './context/StoreContext';
import { Header } from './components/Header';
import { SearchBar } from './components/SearchBar';
import { BannerCarousel } from './components/BannerCarousel';
import { CategoryFilter } from './components/CategoryFilter';
import { FeaturedProducts } from './components/FeaturedProducts';
import { ProductGrid } from './components/ProductGrid';
import { Toast } from './components/Toast';
import { AdminLoginModal } from './admin/AdminLoginModal';
import { AdminLayout, AdminTab } from './admin/AdminLayout';
import { DashboardOverview } from './admin/DashboardOverview';
import { ProductManager } from './admin/ProductManager';
import { ProductFormModal } from './admin/ProductFormModal';
import { BannerManager } from './admin/BannerManager';
import { BannerFormModal } from './admin/BannerFormModal';
import { CategoryManager } from './admin/CategoryManager';
import { SettingsManager } from './admin/SettingsManager';
import { LoginDetailsManager } from './admin/LoginDetailsManager';
import { AdManager } from './admin/AdManager';
import { BlockedScreen } from './components/BlockedScreen';
import { AdDisplaySlot } from './components/AdDisplaySlot';
import { getCurrentDeviceInfo, checkServerBlockedStatus } from './lib/deviceFingerprint';
import { subscribeToBlockedDevices, isDeviceBlockedCheck } from './lib/securityService';
import { subscribeToAds } from './lib/adService';
import { Product, Banner, DeviceInfo, BlockedDevice, AdsterraAd } from './types';

const MainAppContent: React.FC = () => {
  const { user } = useAuth();
  const {
    publicProducts,
    activeBanners,
    categories,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    loading,
    toastMessage,
    settings,
  } = useStore();

  const [isAdminView, setIsAdminView] = useState<boolean>(false);
  const [adminTab, setAdminTab] = useState<AdminTab>('dashboard');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);

  // Adsterra Ads state
  const [ads, setAds] = useState<AdsterraAd[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToAds((list) => {
      setAds(list);
    });
    return () => unsubscribe();
  }, []);

  // Device blocking enforcement
  const [currentDevice, setCurrentDevice] = useState<DeviceInfo | null>(null);
  const [blockedRecord, setBlockedRecord] = useState<BlockedDevice | null>(null);

  useEffect(() => {
    let mounted = true;
    getCurrentDeviceInfo().then((dev) => {
      if (mounted) setCurrentDevice(dev);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!currentDevice) return;

    // 1. Subscribe to local and Firestore blocked devices
    const unsubscribe = subscribeToBlockedDevices((blockedList) => {
      const match = isDeviceBlockedCheck(
        currentDevice.deviceId,
        currentDevice.ip,
        blockedList
      );
      if (match) {
        setBlockedRecord(match);
      } else {
        setBlockedRecord(null);
      }
    });

    // 2. Check server-side blocked status (ensures cross-device & cross-browser synchronization)
    const checkServer = async () => {
      const serverCheck = await checkServerBlockedStatus(currentDevice.deviceId);
      if (serverCheck.isBlocked && serverCheck.matchedRecord) {
        setBlockedRecord(serverCheck.matchedRecord);
      }
    };
    checkServer();
    const interval = setInterval(checkServer, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [currentDevice]);

  // Modals for admin creation/editing
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [isBannerModalOpen, setIsBannerModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);

  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setIsProductModalOpen(true);
  };

  const handleOpenAddBanner = () => {
    setEditingBanner(null);
    setIsBannerModalOpen(true);
  };

  const handleOpenEditBanner = (ban: Banner) => {
    setEditingBanner(ban);
    setIsBannerModalOpen(true);
  };

  // If this device is blocked by administrator, halt all access and show BlockedScreen
  if (blockedRecord) {
    return (
      <BlockedScreen
        blockedInfo={blockedRecord}
        deviceInfo={currentDevice}
        onRefresh={() => {
          getCurrentDeviceInfo().then((dev) => {
            setCurrentDevice(dev);
          });
        }}
        contactEmail={settings?.contactEmail}
      />
    );
  }

  // If user is logged in as admin and viewing admin console
  if (user?.isAdmin && isAdminView) {
    return (
      <AdminLayout
        currentTab={adminTab}
        setCurrentTab={setAdminTab}
        onExitAdmin={() => setIsAdminView(false)}
      >
        {adminTab === 'dashboard' && (
          <DashboardOverview
            onNavigateTab={(tab) => setAdminTab(tab)}
            onOpenAddProduct={handleOpenAddProduct}
          />
        )}
        {adminTab === 'products' && (
          <ProductManager
            onOpenAddModal={handleOpenAddProduct}
            onOpenEditModal={handleOpenEditProduct}
          />
        )}
        {adminTab === 'banners' && (
          <BannerManager
            onOpenAddModal={handleOpenAddBanner}
            onOpenEditModal={handleOpenEditBanner}
          />
        )}
        {adminTab === 'ads' && <AdManager />}
        {adminTab === 'categories' && <CategoryManager />}
        {adminTab === 'settings' && <SettingsManager />}
        {adminTab === 'login-details' && <LoginDetailsManager />}

        {/* Admin Modals */}
        <ProductFormModal
          isOpen={isProductModalOpen}
          onClose={() => {
            setIsProductModalOpen(false);
            setEditingProduct(null);
          }}
          productToEdit={editingProduct}
        />

        <BannerFormModal
          isOpen={isBannerModalOpen}
          onClose={() => {
            setIsBannerModalOpen(false);
            setEditingBanner(null);
          }}
          bannerToEdit={editingBanner}
        />

        <Toast message={toastMessage} />
      </AdminLayout>
    );
  }

  // PUBLIC STOREFRONT VIEW
  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA] selection:bg-amber-400 selection:text-neutral-900">
      {/* Sticky Header */}
      <Header
        onOpenLogin={() => setIsLoginModalOpen(true)}
        isAdminView={isAdminView}
        setIsAdminView={setIsAdminView}
      />

      {/* Main Public Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3.5 sm:px-6 py-4 sm:py-6">
        {/* Search Bar on Mobile & Desktop */}
        <div className="mb-5 sm:mb-6">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </div>

        {/* Promotional / Offer Banner Carousel (Hides completely if empty) */}
        {!searchQuery && <BannerCarousel banners={activeBanners} />}

        {/* Adsterra: After Banner Placement */}
        {!searchQuery && <AdDisplaySlot placement="after_banner" allAds={ads} />}

        {/* Category Filter Pills */}
        <CategoryFilter
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />

        {/* Featured Products Section (shown when no active search query) */}
        {!searchQuery && selectedCategory === 'all' && (
          <FeaturedProducts products={publicProducts} />
        )}

        {/* Product Catalog Listing with configurable Ad placements */}
        <section aria-label="Product Catalog">
          <div className="flex items-center justify-between mb-3.5">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight">
                {searchQuery
                  ? `Search Results for "${searchQuery}"`
                  : selectedCategory !== 'all'
                  ? `${categories.find((c) => c.slug === selectedCategory)?.name || 'Category'} Discoveries`
                  : 'Popular Discoveries'}
              </h2>
              <span className="text-[11px] text-neutral-500">
                {publicProducts.length} {publicProducts.length === 1 ? 'item' : 'items'} curated
              </span>
            </div>
          </div>

          {/* 2-column mobile grid, 3 on tablet, 4-6 on desktop with mid-grid Ads */}
          <ProductGrid
            products={publicProducts}
            ads={ads}
            loading={loading}
            onResetFilters={() => {
              setSearchQuery('');
              setSelectedCategory('all');
            }}
          />
        </section>

        {/* Adsterra: Before Footer Placement */}
        <AdDisplaySlot placement="before_footer" allAds={ads} />
      </main>

      {/* Discreet Sign In Modal */}
      <AdminLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={() => setIsAdminView(true)}
      />

      {/* Notification Toast */}
      <Toast message={toastMessage} />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <StoreProvider>
        <MainAppContent />
      </StoreProvider>
    </AuthProvider>
  );
}
