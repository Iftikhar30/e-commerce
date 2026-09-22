import React from 'react';
import { useStore } from '../context/StoreContext';
import {
  Package,
  Eye,
  EyeOff,
  Pin,
  Sparkles,
  MousePointerClick,
  Image as ImageIcon,
  Plus,
  ArrowUpRight,
} from 'lucide-react';

interface DashboardOverviewProps {
  onNavigateTab: (tab: 'products' | 'banners' | 'categories' | 'settings') => void;
  onOpenAddProduct: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  onNavigateTab,
  onOpenAddProduct,
}) => {
  const { allProducts, allBanners } = useStore();

  const totalProducts = allProducts.length;
  const activeProducts = allProducts.filter((p) => p.active).length;
  const hiddenProducts = allProducts.filter((p) => !p.active).length;
  const pinnedProducts = allProducts.filter((p) => p.pinned).length;
  const featuredProducts = allProducts.filter((p) => p.featured).length;
  const totalClicks = allProducts.reduce((sum, p) => sum + (p.clickCount || 0), 0);
  const activeBannersCount = allBanners.filter((b) => b.active).length;

  const topClickedProducts = [...allProducts]
    .sort((a, b) => (b.clickCount || 0) - (a.clickCount || 0))
    .slice(0, 6);

  const stats = [
    {
      label: 'Total Products',
      val: totalProducts,
      icon: Package,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'Active (Live)',
      val: activeProducts,
      icon: Eye,
      color: 'text-emerald-600 bg-emerald-50',
    },
    {
      label: 'Hidden (Draft)',
      val: hiddenProducts,
      icon: EyeOff,
      color: 'text-neutral-600 bg-neutral-100',
    },
    {
      label: 'Pinned Top',
      val: pinnedProducts,
      icon: Pin,
      color: 'text-amber-600 bg-amber-50',
    },
    {
      label: 'Featured Highlights',
      val: featuredProducts,
      icon: Sparkles,
      color: 'text-purple-600 bg-purple-50',
    },
    {
      label: 'Total Product Clicks',
      val: totalClicks.toLocaleString(),
      icon: MousePointerClick,
      color: 'text-rose-600 bg-rose-50',
    },
    {
      label: 'Active Banners',
      val: activeBannersCount,
      icon: ImageIcon,
      color: 'text-cyan-600 bg-cyan-50',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-neutral-200/90 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 tracking-tight">
            Storefront Overview
          </h2>
          <p className="text-xs text-neutral-500">
            Real-time catalog analytics, visibility metrics, and Amazon redirection performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenAddProduct}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
          >
            <Plus size={15} />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-2xs flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-neutral-500">{item.label}</span>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${item.color}`}>
                  <Icon size={16} />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">
                {item.val}
              </div>
            </div>
          );
        })}
      </div>

      {/* Top Clicked Products Table / Ranking */}
      <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-neutral-900">
              Top Products by Click Count
            </h3>
            <p className="text-xs text-neutral-500">
              Products driving the highest visitor redirects to Amazon
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('products')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-700"
          >
            <span>View All</span>
            <ArrowUpRight size={14} />
          </button>
        </div>

        <div className="divide-y divide-neutral-100">
          {topClickedProducts.map((prod, index) => (
            <div
              key={prod.id}
              className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-neutral-50/80 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs font-bold text-neutral-400 w-4 text-center">
                  #{index + 1}
                </span>
                <img
                  src={prod.image}
                  alt={prod.title}
                  className="w-10 h-10 object-contain rounded-lg bg-neutral-50 p-1 border border-neutral-200/60 shrink-0"
                />
                <div className="min-w-0">
                  <h4 className="text-xs font-semibold text-neutral-900 truncate">
                    {prod.title}
                  </h4>
                  <div className="flex items-center gap-2 text-[11px] text-neutral-500 mt-0.5">
                    <span className="capitalize font-medium">{prod.category}</span>
                    <span>•</span>
                    <span className={prod.active ? 'text-emerald-600' : 'text-neutral-400'}>
                      {prod.active ? 'Active' : 'Hidden'}
                    </span>
                    {prod.pinned && (
                      <>
                        <span>•</span>
                        <span className="text-amber-600 font-medium">Pinned</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 text-xs font-bold">
                  <MousePointerClick size={12} className="text-amber-600" />
                  <span>{(prod.clickCount || 0).toLocaleString()} clicks</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
