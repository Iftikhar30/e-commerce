import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
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
        <div className="max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  );
};
