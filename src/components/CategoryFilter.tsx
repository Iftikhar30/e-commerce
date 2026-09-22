import React from 'react';
import { Category } from '../types';

interface CategoryFilterProps {
  categories: Category[];
  selectedCategory: string;
  onSelectCategory: (slug: string) => void;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
}) => {
  return (
    <div className="w-full mb-6">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
        <button
          type="button"
          id="category-all-button"
          onClick={() => onSelectCategory('all')}
          className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
            selectedCategory === 'all'
              ? 'bg-neutral-900 text-white shadow-xs'
              : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200/80'
          }`}
        >
          All Products
        </button>

        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.slug;
          return (
            <button
              key={cat.id}
              type="button"
              id={`category-${cat.slug}-button`}
              onClick={() => onSelectCategory(cat.slug)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                isSelected
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200/80'
              }`}
            >
              {cat.name}
            </button>
          );
        })}
      </div>
    </div>
  );
};
