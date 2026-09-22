import React, { useEffect, useRef, useMemo } from 'react';
import { AdsterraAd, AdPlacement } from '../types';

interface AdDisplaySlotProps {
  placement?: AdPlacement;
  ad?: AdsterraAd;
  allAds?: AdsterraAd[];
  className?: string;
  showAdminPlaceholder?: boolean;
}

export const AdDisplaySlot: React.FC<AdDisplaySlotProps> = ({
  placement,
  ad: directAd,
  allAds = [],
  className = '',
  showAdminPlaceholder = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Find the matching active ad for this placement if not passed directly
  const activeAd = useMemo(() => {
    if (directAd) return directAd;
    if (!placement) return undefined;
    return allAds
      .filter((a) => a.active && a.placement === placement)
      .sort((a, b) => a.order - b.order)[0];
  }, [directAd, placement, allAds]);

  // Derive width and height from size or fields
  const { width, height } = useMemo(() => {
    if (!activeAd) return { width: 320, height: 50 };

    if (activeAd.size === '320x50') return { width: 320, height: 50 };
    if (activeAd.size === '300x250') return { width: 300, height: 250 };
    if (activeAd.size === '728x90') return { width: 728, height: 90 };

    // Fallback to custom fields or regex extraction from adCode
    let w = activeAd.width || 320;
    let h = activeAd.height || 50;

    if (activeAd.adCode) {
      const widthMatch = activeAd.adCode.match(/['"]width['"]\s*:\s*(\d+)/i);
      const heightMatch = activeAd.adCode.match(/['"]height['"]\s*:\s*(\d+)/i);
      if (widthMatch && widthMatch[1]) w = parseInt(widthMatch[1], 10);
      if (heightMatch && heightMatch[1]) h = parseInt(heightMatch[1], 10);
    }

    return { width: w, height: h };
  }, [activeAd]);

  // Execute and render the Adsterra script inside an isolated sandbox iframe
  useEffect(() => {
    if (!activeAd || !activeAd.active || !activeAd.adCode) return;

    const iframe = iframeRef.current;
    if (!iframe) return;

    let isMounted = true;

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
                  margin: 0;
                  padding: 0;
                  width: 100%;
                  height: 100%;
                  background: transparent;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  overflow: hidden;
                }
              </style>
            </head>
            <body>
              ${activeAd.adCode}
            </body>
          </html>
        `);
        doc.close();
      }
    } catch (err) {
      console.warn('Adsterra script execution notice:', err);
    }

    return () => {
      isMounted = false;
      // Cleanup on unmount to avoid ghost listeners
      if (iframe) {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow?.document;
          if (doc) {
            doc.open();
            doc.write('');
            doc.close();
          }
        } catch {
          // ignore
        }
      }
    };
  }, [activeAd?.id, activeAd?.adCode, activeAd?.active, width, height]);

  // If ad is inactive or not found
  if (!activeAd || !activeAd.active) {
    if (showAdminPlaceholder) {
      return (
        <div className="p-3 border border-dashed border-neutral-300 rounded-xl text-center text-xs text-neutral-400 bg-neutral-50/50">
          No active Adsterra ad configured for placement: <strong>{placement}</strong>
        </div>
      );
    }
    return null;
  }

  // Responsive device visibility classes
  const deviceClass =
    activeAd.deviceTarget === 'mobile_only'
      ? 'md:hidden'
      : activeAd.deviceTarget === 'desktop_only'
      ? 'hidden md:flex'
      : 'flex';

  return (
    <div
      ref={containerRef}
      id={`ad-slot-${activeAd.id}`}
      className={`my-3 sm:my-4 flex-col items-center justify-center w-full ${deviceClass} ${className}`}
    >
      <div className="flex flex-col items-center justify-center max-w-full overflow-hidden">
        {/* Adsterra container frame with isolation */}
        <div
          className="relative flex items-center justify-center bg-transparent overflow-hidden max-w-full"
          style={{
            width: width ? `${width}px` : '100%',
            height: height ? `${height}px` : 'auto',
            minHeight: height ? `${height}px` : '50px',
          }}
        >
          <iframe
            ref={iframeRef}
            title={activeAd.title || 'Advertisement'}
            scrolling="no"
            frameBorder="0"
            className="border-0 bg-transparent overflow-hidden"
            style={{
              width: `${width}px`,
              height: `${height}px`,
              maxWidth: '100%',
            }}
          />
        </div>

        {/* Minimal neutral label without misleading UI */}
        <span className="text-[9px] uppercase tracking-wider text-neutral-400/80 mt-1 select-none font-medium">
          Advertisement
        </span>
      </div>
    </div>
  );
};
