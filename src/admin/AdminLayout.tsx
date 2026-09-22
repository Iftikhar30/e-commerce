import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { isFirebaseConfigured } from '../lib/firebase';
import {
  LayoutDashboard,
  Package,
  Image as ImageIcon,
  Tag,
  Settings as SettingsIcon,
  LogOut,
  ShoppingBag,
  Menu,
  X,
  Cloud,
  CloudOff,
  AlertTriangle,
} from 'lucide-react';

export type AdminTab = 'dashboard' | 'products' | 'banners' | 'categories' | 'settings';

interface AdminLayoutProps {
  currentTab: AdminTab;
  setCurrentTab: (tab: AdminTab) => void;
  onExitAdmin: () => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentTab,
  setCurrentTab,
  onExitAdmin,
  children,
}) => {
  const { user, logout } = useAuth();
  const { settings } = useStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'dashboard' as AdminTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'products' as AdminTab, label: 'Products', icon: Package },
    { id: 'banners' as AdminTab, label: 'Offers & Banners', icon: ImageIcon },
    { id: 'categories' as AdminTab, label: 'Categories', icon: Tag },
    { id: 'settings' as AdminTab, label: 'Settings', icon: SettingsIcon },
  ];

  const handleTabClick = (tab: AdminTab) => {
    setCurrentTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col md:flex-row">
      {/* Mobile Topbar */}
      <div className="md:hidden bg-neutral-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-400 text-neutral-950 flex items-center justify-center font-bold">
            <ShoppingBag size={16} />
          </div>
          <span className="font-bold text-sm tracking-tight">Admin Console</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onExitAdmin}
            className="text-xs bg-neutral-800 text-neutral-200 px-2.5 py-1.5 rounded-md hover:bg-neutral-700"
          >
            Storefront
          </button>
          <button
            type="button"
            aria-label="Toggle Navigation"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 text-neutral-300 hover:text-white"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={`${
          mobileMenuOpen ? 'block' : 'hidden'
        } md:block w-full md:w-64 bg-neutral-900 text-neutral-300 flex-shrink-0 z-30 md:sticky md:top-0 md:h-screen flex flex-col justify-between p-4`}
      >
        <div>
          {/* Header Brand */}
          <div className="hidden md:flex items-center justify-between pb-6 mb-4 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-400 text-neutral-950 flex items-center justify-center font-extrabold shadow-xs">
                <ShoppingBag size={18} />
              </div>
              <div>
                <h1 className="font-extrabold text-sm text-white leading-tight">
                  {settings.siteName || 'IFTI TechZyro'} Admin
                </h1>
                <span className="text-[10px] text-neutral-400">Store Management</span>
              </div>
            </div>
          </div>

          {/* Nav List */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  id={`admin-nav-${item.id}`}
                  onClick={() => handleTabClick(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${
                    isActive
                      ? 'bg-amber-400 text-neutral-950 shadow-xs'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                  }`}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
          {/* Cloud Database Status */}
          <div className="mt-4 pt-3 border-t border-neutral-800/80">
            <div
              className={`px-3 py-2 rounded-xl text-[11px] flex items-center gap-2 font-medium ${
                isFirebaseConfigured
                  ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-800/40'
                  : 'bg-amber-950/40 text-amber-300 border border-amber-800/40'
              }`}
            >
              {isFirebaseConfigured ? (
                <>
                  <Cloud size={14} className="text-emerald-400 flex-shrink-0" />
                  <span className="truncate">Cloud Synced (All Devices)</span>
                </>
              ) : (
                <>
                  <CloudOff size={14} className="text-amber-400 flex-shrink-0" />
                  <span className="truncate">Local Storage Only</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-neutral-800 space-y-2 mt-6">
          <button
            type="button"
            onClick={onExitAdmin}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <ShoppingBag size={15} />
            <span>Back to Public Store</span>
          </button>

          <div className="flex items-center justify-between px-3 py-2 bg-neutral-800/60 rounded-xl">
            <div className="truncate max-w-[130px]">
              <span className="block text-[11px] font-medium text-neutral-200 truncate">
                {user?.email || 'Administrator'}
              </span>
              <span className="block text-[9px] text-amber-400 uppercase font-bold tracking-wider">
                Full Access
              </span>
            </div>
            <button
              type="button"
              title="Sign Out"
              onClick={logout}
              className="p-1.5 text-neutral-400 hover:text-rose-400 transition-colors"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Admin Content Body */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 md:p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-6">
          {!isFirebaseConfigured && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-700 flex-shrink-0 mt-0.5">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-amber-950">
                    Firebase Cloud Database Not Connected (Local Storage Mode)
                  </h3>
                  <p className="text-[11px] text-amber-800 leading-relaxed mt-0.5">
                    Products you add right now are saved only in this browser. To make products visible across all customer devices, phones, and computers, add your Firebase environment variables to Vercel.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCurrentTab('settings')}
                className="text-xs whitespace-nowrap font-bold px-3 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors self-end sm:self-auto shadow-xs"
              >
                View Setup Guide
              </button>
            </div>
          )}

          {children}
        </div>
      </main>
    </div>
  );
};
