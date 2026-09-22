import React, { useState, useEffect } from 'react';
import { Banner } from '../types';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';

interface BannerCarouselProps {
  banners: Banner[];
}

export const BannerCarousel: React.FC<BannerCarouselProps> = ({ banners }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto slide every 5 seconds if multiple banners (hook called unconditionally at top level)
  useEffect(() => {
    if (!banners || banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [banners]);

  // If no banners, hide container completely as requested
  if (!banners || banners.length === 0) {
    return null;
  }

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev === 0 ? banners.length - 1 : prev - 1));
  };

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  };

  const currentBanner = banners[currentIndex] || banners[0];

  const handleBannerClick = () => {
    if (currentBanner.link) {
      window.open(currentBanner.link, '_blank', 'noopener,noreferrer');
    }
  };

  const isClickable = Boolean(currentBanner.link);

  return (
    <section aria-label="Featured Offers and Promotions" className="relative w-full mb-6">
      <div
        id="promotional-banner-card"
        onClick={handleBannerClick}
        className={`relative w-full rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-200/80 shadow-xs transition-all duration-300 ${
          isClickable ? 'cursor-pointer hover:shadow-md' : 'cursor-default'
        }`}
        style={{ minHeight: '140px', maxHeight: '340px' }}
      >
        {/* Banner Graphic Image */}
        <div className="relative w-full aspect-[21/9] sm:aspect-[24/8] md:aspect-[3/1] overflow-hidden">
          <img
            src={currentBanner.image}
            alt={currentBanner.title || 'Promotional Banner'}
            className="w-full h-full object-cover object-center"
            loading="eager"
          />

          {/* Overlay gradient for text legibility if title exists */}
          {currentBanner.title && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-4 sm:p-6">
              <div className="max-w-xl">
                <h2 className="text-sm sm:text-lg md:text-xl font-bold text-white leading-tight drop-shadow-sm line-clamp-2">
                  {currentBanner.title}
                </h2>
                {isClickable && (
                  <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-amber-300 mt-1">
                    Explore Offer <ExternalLink size={12} />
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Advertisement Tag (if enabled) */}
        {currentBanner.isAd && (
          <div className="absolute top-2.5 right-2.5 z-20 bg-black/75 backdrop-blur-xs text-[9px] sm:text-[10px] tracking-widest text-neutral-200 px-2 py-0.5 rounded uppercase font-semibold border border-white/20">
            Advertisement
          </div>
        )}

        {/* Arrows for multi-banners */}
        {banners.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous banner"
              onClick={(e) => {
                e.stopPropagation();
                prevSlide();
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-xs transition-colors z-20"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              aria-label="Next banner"
              onClick={(e) => {
                e.stopPropagation();
                nextSlide();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-xs transition-colors z-20"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}
      </div>

      {/* Indicator Dots */}
      {banners.length > 1 && (
        <div className="flex justify-center items-center gap-1.5 mt-2.5">
          {banners.map((_, idx) => (
            <button
              key={idx}
              type="button"
              aria-label={`Go to slide ${idx + 1}`}
              onClick={() => setCurrentIndex(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === currentIndex ? 'w-6 bg-amber-500' : 'w-1.5 bg-neutral-300 hover:bg-neutral-400'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
};
