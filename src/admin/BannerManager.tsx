import React, { useState } from 'react';
import { Banner } from '../types';
import { useStore } from '../context/StoreContext';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import {
  Plus,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  Tv,
  Image as ImageIcon,
  Code2,
} from 'lucide-react';

interface BannerManagerProps {
  onOpenAddModal: () => void;
  onOpenEditModal: (banner: Banner) => void;
}

export const BannerManager: React.FC<BannerManagerProps> = ({
  onOpenAddModal,
  onOpenEditModal,
}) => {
  const { allBanners, deleteBannerAction, saveBannerAction, reorderBannersAction } =
    useStore();

  const [deleteTarget, setDeleteTarget] = useState<Banner | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const toggleBannerActive = async (banner: Banner) => {
    await saveBannerAction({
      id: banner.id,
      active: !banner.active,
    });
  };

  const toggleBannerAd = async (banner: Banner) => {
    await saveBannerAction({
      id: banner.id,
      isAd: !banner.isAd,
    });
  };

  const moveUp = async (index: number) => {
    if (index <= 0) return;
    const updated = [...allBanners];
    const temp = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = temp;
    await reorderBannersAction(updated);
  };

  const moveDown = async (index: number) => {
    if (index >= allBanners.length - 1) return;
    const updated = [...allBanners];
    const temp = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = temp;
    await reorderBannersAction(updated);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteBannerAction(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-neutral-200/90 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 tracking-tight">
            অফার ব্যানার ও স্পন্সর Ad (Promotional Banners & Ads)
          </h2>
          <p className="text-xs text-neutral-500">
            হোমপেজের টপ স্লাইডার ব্যানার, অফার গ্রাফিক্স এবং Adsterra বিজ্ঞাপন পরিচালনা করুন
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenAddModal}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-amber-400 hover:bg-amber-500 text-neutral-950 rounded-xl text-xs font-bold transition-colors shadow-xs shrink-0 cursor-pointer"
        >
          <Plus size={16} className="stroke-[2.5]" />
          <span>নতুন ব্যানার / Ad যোগ করুন</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-2xs overflow-hidden">
        {allBanners.length === 0 ? (
          <div className="text-center py-12 px-4 text-xs text-neutral-500">
            এখনও কোনো অফার ব্যানার বা বিজ্ঞাপন যোগ করা হয়নি। "নতুন ব্যানার / Ad যোগ করুন" বাটনে ক্লিক করুন।
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {allBanners.map((banner, index) => {
              const isScriptAd = banner.type === 'ad' || Boolean(banner.adCode);

              return (
                <div
                  key={banner.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-neutral-50/70 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex sm:flex-col items-center gap-0.5 text-neutral-400">
                      <button
                        type="button"
                        onClick={() => moveUp(index)}
                        disabled={index === 0}
                        className="p-1 hover:text-neutral-800 disabled:opacity-30 cursor-pointer"
                        title="উপরে নিন"
                      >
                        <ChevronUp size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveDown(index)}
                        disabled={index === allBanners.length - 1}
                        className="p-1 hover:text-neutral-800 disabled:opacity-30 cursor-pointer"
                        title="নিচে নিন"
                      >
                        <ChevronDown size={15} />
                      </button>
                    </div>

                    {isScriptAd ? (
                      <div className="w-24 h-14 bg-neutral-900 rounded-xl border border-neutral-700 flex flex-col items-center justify-center text-amber-400 shrink-0 p-1">
                        <Tv size={18} />
                        <span className="text-[9px] font-mono font-bold mt-0.5">
                          {banner.adSize === 'custom' && banner.customWidth
                            ? `${banner.customWidth}x${banner.customHeight}`
                            : banner.adSize || '300x250'}
                        </span>
                      </div>
                    ) : (
                      <img
                        src={banner.image}
                        alt={banner.title || 'Banner'}
                        className="w-24 h-14 object-cover rounded-xl border border-neutral-200 shrink-0"
                      />
                    )}

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs sm:text-sm font-bold text-neutral-900 truncate">
                          {banner.title || (isScriptAd ? 'Adsterra Script Banner' : 'ইমেজ ব্যানার')}
                        </h4>
                        {isScriptAd ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-900 rounded-md flex items-center gap-1">
                            <Code2 size={11} /> Adsterra Ad ({banner.adSize || '300x250'})
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded-md flex items-center gap-1">
                            <ImageIcon size={11} /> সাধারণ ব্যানার
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-neutral-500 flex-wrap">
                        <span
                          className={`font-semibold ${
                            banner.active ? 'text-emerald-600' : 'text-neutral-400'
                          }`}
                        >
                          {banner.active ? 'Active (লাইভ)' : 'Hidden (বন্ধ)'}
                        </span>

                        {banner.isAd && !isScriptAd && (
                          <>
                            <span>•</span>
                            <span className="text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded font-bold uppercase text-[9px] border border-amber-200">
                              AD Badge ON
                            </span>
                          </>
                        )}

                        {banner.link ? (
                          <>
                            <span>•</span>
                            <span className="text-neutral-400 truncate max-w-xs flex items-center gap-0.5">
                              <ExternalLink size={10} /> {banner.link}
                            </span>
                          </>
                        ) : (
                          <>
                            <span>•</span>
                            <span className="text-neutral-400 italic">
                              {isScriptAd ? 'Script based rendering' : 'No link'}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleBannerActive(banner)}
                      title={banner.active ? 'Deactivate' : 'Activate'}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                        banner.active
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                          : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                      }`}
                    >
                      {banner.active ? 'Active' : 'Inactive'}
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenEditModal(banner)}
                      className="p-2 text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
                      title="সম্পাদনা করুন"
                    >
                      <Edit2 size={15} />
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteTarget(banner)}
                      className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                      title="মুছে ফেলুন"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <DeleteConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="ব্যানার মুছে ফেলুন"
        message="আপনি কি নিশ্চিত যে এই অফার ব্যানার বা বিজ্ঞাপনটি মুছে ফেলতে চান?"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={isDeleting}
      />
    </div>
  );
};

