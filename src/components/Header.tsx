import React from 'react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { ShoppingBag, ShieldCheck, LogIn, LayoutDashboard } from 'lucide-react';

interface HeaderProps {
  onOpenLogin: () => void;
  isAdminView: boolean;
  setIsAdminView: (val: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenLogin,
  isAdminView,
  setIsAdminView,
}) => {
  const { settings } = useStore();
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-neutral-200/80 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-4">
        {/* Brand Logo & Name */}
        <button
          type="button"
          onClick={() => setIsAdminView(false)}
          className="flex items-center gap-2 text-left shrink-0 group"
          id="brand-home-logo"
        >
          {settings.logoUrl ? (
            <img
              src={settings.logoUrl}
              alt={settings.siteName}
              className="h-7 sm:h-8 w-auto object-contain"
            />
          ) : (
            <div className="w-8 h-8 rounded-xl bg-amber-400 flex items-center justify-center text-neutral-950 font-black shadow-xs group-hover:bg-amber-500 transition-colors">
              <ShoppingBag size={18} className="stroke-[2.5]" />
            </div>
          )}
          <span className="font-extrabold text-base sm:text-lg tracking-tight text-neutral-900 group-hover:text-amber-600 transition-colors">
            {settings.siteName || 'IFTI TechZyro'}
          </span>
        </button>

        {/* Right Navigation / Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {user?.isAdmin ? (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                id="toggle-admin-view-button"
                onClick={() => setIsAdminView(!isAdminView)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-xs ${
                  isAdminView
                    ? 'bg-neutral-900 text-white hover:bg-neutral-800'
                    : 'bg-amber-400 text-neutral-950 hover:bg-amber-500'
                }`}
              >
                {isAdminView ? (
                  <>
                    <ShoppingBag size={14} />
                    <span>Storefront</span>
                  </>
                ) : (
                  <>
                    <LayoutDashboard size={14} />
                    <span>Dashboard</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <button
              type="button"
              id="header-login-button"
              onClick={onOpenLogin}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-950 px-2.5 py-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
            >
              <LogIn size={14} />
              <span>Login</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
