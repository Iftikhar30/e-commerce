import React, { useState, useEffect, useRef } from 'react';
import { Banner } from '../types';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';

interface BannerCarouselProps {
  banners: Banner[];
}

export const BannerCarousel: React.FC<BannerCarouselProps> = ({ banners }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const adIframeRef = useRef<HTMLIFrameElement>(null);

  // Auto slide every 6 seconds if multiple banners
  useEffect(() => {
    if (!banners || banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [banners]);

  const currentBanner = banners[currentIndex] || banners[0];
  const isScriptAd = currentBanner?.type === 'ad' || Boolean(currentBanner?.adCode);

  // Render isolated ad script inside sandbox iframe when current banner is an ad
  useEffect(() => {
    if (!isScriptAd || !currentBanner?.adCode) return;

    const iframe = adIframeRef.current;
    if (!iframe) return;

    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                *, *::before, *::after { box-sizing: border-box; }
                html, body {
                  margin: 0; padding: 0; width: 100%; height: 100%;
                  background: transparent; display: flex;
                  justify-content: center; align-items: center;
                  overflow: hidden;
                }
              </style>
            </head>
            <body>
              ${currentBanner.adCode}
            </body>
          </html>
        `);
        doc.close();
      }
    } catch {
      // ignore
    }
  }, [isScriptAd, currentBanner?.id, currentBanner?.adCode, currentIndex]);

  // If no banners, hide container completely
  if (!banners || banners.length === 0) {
    return null;
  }

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev === 0 ? banners.length - 1 : prev - 1));
  };

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  };

  const handleBannerClick = () => {
    if (!isScriptAd && currentBanner.link) {
      window.open(currentBanner.link, '_blank', 'noopener,noreferrer');
    }
  };

  const isClickable = !isScriptAd && Boolean(currentBanner.link);

  // Dimensions for Ad in Banner
  const adWidth =
    currentBanner.adSize === 'custom' && currentBanner.customWidth
      ? currentBanner.customWidth
      : currentBanner.adSize === '728x90'
      ? 728
      : currentBanner.adSize === '320x50'
      ? 320
      : 300;
  const adHeight =
    currentBanner.adSize === 'custom' && currentBanner.customHeight
      ? currentBanner.customHeight
      : currentBanner.adSize === '728x90'
      ? 90
      : currentBanner.adSize === '320x50'
      ? 50
      : 250;

  return (
    <section aria-label="Featured Offers and Promotions" className="relative w-full mb-6">
      <div
        id="promotional-banner-card"
        onClick={handleBannerClick}
        className={`relative w-full rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-200/80 shadow-xs transition-all duration-300 ${
          isClickable ? 'cursor-pointer hover:shadow-md' : 'cursor-default'
        }`}
        style={{ minHeight: '140px' }}
      >
        {isScriptAd ? (
          /* SCRIPT AD BANNER PRESENTATION */
          <div className="relative w-full min-h-[160px] sm:min-h-[200px] md:min-h-[260px] flex flex-col items-center justify-center p-4 bg-gradient-to-b from-neutral-900 to-neutral-950 overflow-hidden">
            <div
              className="relative flex items-center justify-center bg-transparent overflow-hidden max-w-full"
              style={{
                width: `${adWidth}px`,
                height: `${adHeight}px`,
                maxWidth: '100%',
              }}
            >
              <iframe
                ref={adIframeRef}
                title={currentBanner.title || 'Advertisement Banner'}
                scrolling="no"
                frameBorder="0"
                className="border-0 bg-transparent overflow-hidden"
                style={{
                  width: `${adWidth}px`,
                  height: `${adHeight}px`,
                  maxWidth: '100%',
                }}
              />
            </div>

            {currentBanner.title && (
              <p className="text-[11px] font-semibold text-neutral-400 mt-2 text-center max-w-md">
                {currentBanner.title}
              </p>
            )}
          </div>
        ) : (
          /* REGULAR GRAPHIC IMAGE BANNER */
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
        )}

        {/* Advertisement Tag (if enabled or if it is an ad) */}
        {(currentBanner.isAd || isScriptAd) && (
          <div className="absolute top-2.5 right-2.5 z-20 bg-black/75 backdrop-blur-xs text-[9px] sm:text-[10px] tracking-widest text-neutral-200 px-2 py-0.5 rounded uppercase font-semibold border border-white/20 select-none">
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
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-xs transition-colors z-20 cursor-pointer"
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
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-xs transition-colors z-20 cursor-pointer"
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
              className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                idx === currentIndex ? 'w-6 bg-amber-500' : 'w-1.5 bg-neutral-300 hover:bg-neutral-400'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
};

