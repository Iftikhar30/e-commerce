import React from 'react';
import { Product } from '../types';
import { ProductCard } from './ProductCard';
import { Sparkles } from 'lucide-react';

interface FeaturedProductsProps {
  products: Product[];
}

export const FeaturedProducts: React.FC<FeaturedProductsProps> = ({ products }) => {
  const featuredList = products.filter((p) => p.featured && p.active);

  if (featuredList.length === 0) return null;

  return (
    <section aria-label="Featured Products" className="mb-8">
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
            <Sparkles size={14} />
          </div>
          <h2 className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight">
            Featured Highlights
          </h2>
        </div>
        <span className="text-[11px] text-neutral-500 font-medium">
          Handpicked top rated
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {featuredList.slice(0, 4).map((prod) => (
          <ProductCard key={prod.id} product={prod} />
        ))}
      </div>
    </section>
  );
};
