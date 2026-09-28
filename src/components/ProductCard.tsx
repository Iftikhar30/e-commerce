import React, { useState } from 'react';
import { Product } from '../types';
import { RatingStars } from './RatingStars';
import { Badge } from './Badge';
import { ExternalLink, ShoppingCart } from 'lucide-react';
import { useStore } from '../context/StoreContext';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { onProductClick, settings } = useStore();
  const [imgError, setImgError] = useState(false);

  const isAliExpress =
    product.platform === 'aliexpress' ||
    Boolean(product.aliexpressUrl && !product.amazonUrl) ||
    Boolean(
      product.affiliateUrl &&
        (product.affiliateUrl.includes('aliexpress') ||
          product.affiliateUrl.includes('ali.ski') ||
          product.affiliateUrl.includes('alitems') ||
          product.affiliateUrl.includes('alicdn'))
    ) ||
    Boolean(product.image && product.image.includes('alicdn'));

  const fallbackImg =
    'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80';

  const discountPercent =
    product.originalPrice && product.price && product.originalPrice > product.price
      ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
      : null;

  return (
    <article
      id={`product-card-${product.id}`}
      onClick={() => onProductClick(product)}
      className={`group relative bg-white rounded-2xl p-3 sm:p-3.5 border border-neutral-200/90 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden ${
        isAliExpress ? 'hover:border-rose-400/80' : 'hover:border-amber-400/80'
      }`}
    >
      {/* Top Media Area */}
      <div>
        <div className="relative w-full aspect-square bg-neutral-50 rounded-xl overflow-hidden mb-2.5 flex items-center justify-center">
          <img
            src={imgError || !product.image ? fallbackImg : product.image}
            alt={product.title}
            loading="lazy"
            onError={() => setImgError(true)}
            className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
          />

          {/* Badge Overlay */}
          {product.badge && (
            <div className="absolute top-2 left-2 z-10">
              <Badge type={product.badge} />
            </div>
          )}

          {discountPercent && (
            <div className="absolute top-2 right-2 z-10 bg-rose-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-xs">
              -{discountPercent}%
            </div>
          )}
        </div>

        {/* Platform Indicator Label & Rating Row */}
        <div className="flex items-center justify-between gap-1 mb-1.5">
          {isAliExpress ? (
            <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-rose-700 bg-rose-50 border border-rose-200/90 px-2 py-0.5 rounded-md tracking-tight shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
              AliExpress
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-amber-800 bg-amber-50 border border-amber-200/90 px-2 py-0.5 rounded-md tracking-tight shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              Amazon
            </span>
          )}
          <RatingStars rating={product.rating} reviewCount={product.reviewCount} />
        </div>

        {/* Product Title */}
        <h3
          className={`text-xs sm:text-sm font-semibold text-neutral-900 line-clamp-2 leading-snug transition-colors mb-2 ${
            isAliExpress ? 'group-hover:text-rose-600' : 'group-hover:text-amber-700'
          }`}
        >
          {product.title}
        </h3>
      </div>

      {/* Bottom Price & Action Row */}
      <div className="pt-2 border-t border-neutral-100/90 mt-auto flex items-center justify-between gap-2">
        <div>
          {product.price !== undefined ? (
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-sm sm:text-base font-bold text-neutral-950">
                {settings.currency || '$'}
                {product.price.toFixed(2)}
              </span>
              {product.originalPrice && product.originalPrice > product.price && (
                <span className="text-xs text-neutral-400 line-through">
                  {settings.currency || '$'}
                  {product.originalPrice.toFixed(2)}
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs font-medium text-neutral-600">Check Price</span>
          )}
        </div>

        {isAliExpress ? (
          <button
            type="button"
            id={`view-aliexpress-${product.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onProductClick(product);
            }}
            className="inline-flex items-center gap-1 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg shadow-xs hover:shadow transition-all shrink-0 cursor-pointer"
            aria-label={`View ${product.title} on AliExpress`}
          >
            <span>AliExpress</span>
            <ExternalLink size={12} className="stroke-[2.5]" />
          </button>
        ) : (
          <button
            type="button"
            id={`view-amazon-${product.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onProductClick(product);
            }}
            className="inline-flex items-center gap-1 bg-amber-400 hover:bg-amber-500 text-neutral-950 text-xs font-bold px-2.5 py-1.5 rounded-lg shadow-xs transition-colors shrink-0 cursor-pointer"
            aria-label={`View ${product.title} on Amazon`}
          >
            <span>Amazon</span>
            <ExternalLink size={12} className="stroke-[2.5]" />
          </button>
        )}
      </div>
    </article>
  );
};
