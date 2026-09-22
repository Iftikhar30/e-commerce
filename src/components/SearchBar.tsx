import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = 'Search products, gadgets, gifts...',
}) => {
  return (
    <div className="relative w-full max-w-xl mx-auto">
      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
        <Search size={16} />
      </div>
      <input
        type="text"
        id="global-product-search-input"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-10 py-2.5 bg-white border border-neutral-200/90 rounded-xl text-xs sm:text-sm text-neutral-900 placeholder-neutral-400 focus:outline-hidden focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 shadow-xs transition-all"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-400 hover:text-neutral-600 transition-colors"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
};
