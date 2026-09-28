import React from 'react';
import { X, ExternalLink, ShoppingBag, ArrowRight } from 'lucide-react';
import { AffiliatePlatform } from '../types';

interface PlatformSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlatform: (platform: AffiliatePlatform) => void;
}

export const PlatformSelectModal: React.FC<PlatformSelectModalProps> = ({
  isOpen,
  onClose,
  onSelectPlatform,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white rounded-3xl max-w-lg w-full p-6 border border-neutral-200 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-neutral-100">
          <div>
            <h3 className="text-lg font-bold text-neutral-900 tracking-tight">
              Select Platform / প্ল্যাটফর্ম নির্বাচন করুন
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              Choose the affiliate platform you want to add a product from:
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-xl hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* 2 Platform Choices: AliExpress & Amazon */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 my-2">
          {/* 1. AliExpress Option */}
          <button
            type="button"
            id="select-platform-aliexpress"
            onClick={() => onSelectPlatform('aliexpress')}
            className="group relative flex flex-col items-start p-4 sm:p-5 rounded-2xl border-2 border-rose-200 hover:border-rose-500 bg-gradient-to-b from-rose-50/70 to-white hover:shadow-lg hover:shadow-rose-100/50 transition-all duration-200 text-left cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-white mb-3 shadow-sm group-hover:scale-105 transition-transform">
              <ShoppingBag size={22} className="stroke-[2.2]" />
            </div>

            <div className="flex items-center gap-1.5 mb-1">
              <h4 className="text-base font-extrabold text-neutral-900 group-hover:text-rose-600 transition-colors">
                AliExpress
              </h4>
              <span className="text-[10px] font-bold text-rose-700 bg-rose-100 border border-rose-300 px-1.5 py-0.2 rounded-full">
                Global
              </span>
            </div>

            <p className="text-[11.5px] text-neutral-500 leading-snug mb-3">
              Import products from AliExpress link with auto-extracted title, photos, price & specs.
            </p>

            <div className="mt-auto pt-2 w-full flex items-center justify-between text-xs font-bold text-rose-600 group-hover:translate-x-0.5 transition-transform">
              <span>Add from AliExpress</span>
              <ArrowRight size={14} />
            </div>
          </button>

          {/* 2. Amazon Option */}
          <button
            type="button"
            id="select-platform-amazon"
            onClick={() => onSelectPlatform('amazon')}
            className="group relative flex flex-col items-start p-4 sm:p-5 rounded-2xl border-2 border-amber-200 hover:border-amber-500 bg-gradient-to-b from-amber-50/70 to-white hover:shadow-lg hover:shadow-amber-100/50 transition-all duration-200 text-left cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center text-neutral-950 mb-3 shadow-sm group-hover:scale-105 transition-transform">
              <span className="text-lg font-black tracking-tight">a</span>
            </div>

            <div className="flex items-center gap-1.5 mb-1">
              <h4 className="text-base font-extrabold text-neutral-900 group-hover:text-amber-700 transition-colors">
                Amazon
              </h4>
              <span className="text-[10px] font-bold text-amber-900 bg-amber-200 border border-amber-300 px-1.5 py-0.2 rounded-full">
                Original
              </span>
            </div>

            <p className="text-[11.5px] text-neutral-500 leading-snug mb-3">
              Import products from Amazon link or ASIN with auto-extracted title, photos, reviews & rating.
            </p>

            <div className="mt-auto pt-2 w-full flex items-center justify-between text-xs font-bold text-amber-800 group-hover:translate-x-0.5 transition-transform">
              <span>Add from Amazon</span>
              <ArrowRight size={14} />
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="pt-3 mt-3 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-400">
          <span>Both platforms support custom affiliate links & click tracking</span>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-700 font-semibold cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
