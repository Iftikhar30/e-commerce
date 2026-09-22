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
  GripVertical,
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
            Promotional Banners & Ads
          </h2>
          <p className="text-xs text-neutral-500">
            Manage top carousel banners, seasonal discount promotions, and sponsor ads
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenAddModal}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold transition-colors shadow-xs shrink-0"
        >
          <Plus size={15} />
          <span>Add Banner</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-2xs overflow-hidden">
        {allBanners.length === 0 ? (
          <div className="text-center py-12 px-4 text-xs text-neutral-500">
            No promotional banners yet. Click "Add Banner" to showcase special deals.
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {allBanners.map((banner, index) => (
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
                      className="p-1 hover:text-neutral-800 disabled:opacity-30"
                    >
                      <ChevronUp size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveDown(index)}
                      disabled={index === allBanners.length - 1}
                      className="p-1 hover:text-neutral-800 disabled:opacity-30"
                    >
                      <ChevronDown size={15} />
                    </button>
                  </div>

                  <img
                    src={banner.image}
                    alt={banner.title || 'Banner'}
                    className="w-24 h-14 object-cover rounded-xl border border-neutral-200 shrink-0"
                  />

                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold text-neutral-900 truncate">
                      {banner.title || 'Untitled Banner Graphic'}
                    </h4>
                    <div className="flex items-center gap-2 text-[11px] text-neutral-500 mt-1 flex-wrap">
                      <span
                        className={`font-semibold ${
                          banner.active ? 'text-emerald-600' : 'text-neutral-400'
                        }`}
                      >
                        {banner.active ? 'Active' : 'Hidden'}
                      </span>
                      {banner.isAd && (
                        <>
                          <span>•</span>
                          <span className="text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded font-bold uppercase text-[9px]">
                            Advertisement Mode
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
                          <span className="text-neutral-400 italic">No link (visual only)</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleBannerActive(banner)}
                    title={banner.active ? 'Deactivate banner' : 'Activate banner'}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      banner.active
                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                    }`}
                  >
                    {banner.active ? 'Active' : 'Inactive'}
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleBannerAd(banner)}
                    title="Toggle AD tag"
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      banner.isAd
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    {banner.isAd ? 'Ad: ON' : 'Ad: OFF'}
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenEditModal(banner)}
                    className="p-1.5 text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100 rounded-lg transition-colors"
                  >
                    <Edit2 size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeleteTarget(banner)}
                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <DeleteConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Delete Banner"
        message="Are you sure you want to delete this promotional banner?"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={isDeleting}
      />
    </div>
  );
};
