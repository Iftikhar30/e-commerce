import React from 'react';
import { Product, AdsterraAd } from '../types';
import { ProductCard } from './ProductCard';
import { SkeletonCard } from './SkeletonCard';
import { ShoppingBag } from 'lucide-react';
import { AdDisplaySlot } from './AdDisplaySlot';

interface ProductGridProps {
  products: Product[];
  ads?: AdsterraAd[];
  loading?: boolean;
  onResetFilters?: () => void;
}

export const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  ads = [],
  loading = false,
  onResetFilters,
}) => {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
        {Array.from({ length: 10 }).map((_, idx) => (
          <SkeletonCard key={idx} />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-16 px-4 bg-white rounded-2xl border border-neutral-200/80 shadow-xs max-w-md mx-auto my-6">
        <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-amber-600">
          <ShoppingBag size={28} />
        </div>
        <h3 className="text-base font-bold text-neutral-900 mb-1">No products available</h3>
        <p className="text-xs text-neutral-500 mb-4">
          We couldn't find any products matching your search or category filter.
        </p>
        {onResetFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex items-center text-xs font-semibold px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors"
          >
            Clear Filters
          </button>
        )}
      </div>
    );
  }

  // Check which mid-grid placements have active ads
  const hasAd4 = ads.some((a) => a.active && a.placement === 'after_4_products');
  const hasAd8 = ads.some((a) => a.active && a.placement === 'after_8_products');
  const hasAd12 = ads.some((a) => a.active && a.placement === 'after_12_products');

  return (
    <div
      id="product-discovery-grid"
      className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-4"
    >
      {products.map((product, idx) => (
        <React.Fragment key={product.id}>
          <ProductCard product={product} />

          {/* Adsterra: After 4 products */}
          {idx === 3 && hasAd4 && (
            <div className="col-span-full py-1">
              <AdDisplaySlot placement="after_4_products" allAds={ads} />
            </div>
          )}

          {/* Adsterra: After 8 products */}
          {idx === 7 && hasAd8 && (
            <div className="col-span-full py-1">
              <AdDisplaySlot placement="after_8_products" allAds={ads} />
            </div>
          )}

          {/* Adsterra: After 12 products */}
          {idx === 11 && hasAd12 && (
            <div className="col-span-full py-1">
              <AdDisplaySlot placement="after_12_products" allAds={ads} />
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

