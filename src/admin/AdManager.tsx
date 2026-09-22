import React, { useState, useEffect } from 'react';
import {
  Tv,
  Plus,
  Edit2,
  Trash2,
  Eye,
  CheckCircle2,
  XCircle,
  Smartphone,
  Monitor,
  Globe,
  Sliders,
  Sparkles,
  Layers,
  Code2,
  Info,
} from 'lucide-react';
import { AdsterraAd, AdPlacement } from '../types';
import { subscribeToAds, deleteAd, toggleAdActive } from '../lib/adService';
import { AdFormModal } from './AdFormModal';
import { AdDisplaySlot } from '../components/AdDisplaySlot';

const PLACEMENT_LABELS: Record<AdPlacement, string> = {
  after_banner: 'After Banner (ব্যানারের নিচে)',
  after_4_products: 'After 4 Products (৪টি প্রোডাক্টের পর)',
  after_8_products: 'After 8 Products (৮টি প্রোডাক্টের পর)',
  after_12_products: 'After 12 Products (১২টি প্রোডাক্টের পর)',
  before_footer: 'Before Footer (ফুটারের আগে)',
};

export const AdManager: React.FC = () => {
  const [ads, setAds] = useState<AdsterraAd[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<AdsterraAd | null>(null);
  const [previewAd, setPreviewAd] = useState<AdsterraAd | null>(null);

  useEffect(() => {
    const unsub = subscribeToAds((list) => {
      setAds(list);
    });
    return () => unsub();
  }, []);

  const handleOpenAdd = () => {
    setEditingAd(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (ad: AdsterraAd) => {
    setEditingAd(ad);
    setIsModalOpen(true);
  };

  const handleDelete = async (adId: string) => {
    if (confirm('আপনি কি নিশ্চিত যে এই Adsterra বিজ্ঞাপনটি মুছে ফেলতে চান?')) {
      await deleteAd(adId);
    }
  };

  const handleToggleActive = async (adId: string, current: boolean) => {
    await toggleAdActive(adId, !current);
  };

  const activeCount = ads.filter((a) => a.active).length;
  const totalCount = ads.length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-neutral-200/90 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
              <Tv size={18} />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-neutral-900 tracking-tight">
              Ad Management (Adsterra Ads)
            </h2>
          </div>
          <p className="text-xs text-neutral-500">
            Adsterra স্ক্রিপ্ট ও বিজ্ঞাপন ইউনিটগুলো আলাদাভাবে পরিচালনা করুন। সাইটের বিভিন্ন পজিশনে (ব্যানারের নিচে, প্রোডাক্ট গ্রিডের মাঝে, ফুটারের আগে) স্বয়ংক্রিয়ভাবে দেখাবে।
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-amber-400 hover:bg-amber-500 text-neutral-950 rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer"
        >
          <Plus size={16} className="stroke-[2.5]" />
          <span>নতুন বিজ্ঞাপন যোগ করুন</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-neutral-200/90 shadow-2xs">
          <span className="text-xs font-semibold text-neutral-500">মোট বিজ্ঞাপন ইউনিট</span>
          <div className="text-2xl font-black text-neutral-900 mt-1">{totalCount}</div>
          <div className="text-[11px] text-neutral-400 mt-0.5">কনফিগার করা Adsterra ইউনিট</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-neutral-200/90 shadow-2xs">
          <span className="text-xs font-semibold text-emerald-700">সক্রিয় বিজ্ঞাপন (Active)</span>
          <div className="text-2xl font-black text-emerald-600 mt-1">{activeCount}</div>
          <div className="text-[11px] text-neutral-400 mt-0.5">ওয়েবসাইটে লাইভ রেন্ডার হচ্ছে</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-neutral-200/90 shadow-2xs">
          <span className="text-xs font-semibold text-neutral-500">সাপোর্টেড সাইজ</span>
          <div className="text-sm font-bold text-neutral-800 mt-2 flex items-center gap-1.5 flex-wrap">
            <span className="bg-neutral-100 px-1.5 py-0.5 rounded text-[11px]">320x50</span>
            <span className="bg-neutral-100 px-1.5 py-0.5 rounded text-[11px]">300x250</span>
            <span className="bg-neutral-100 px-1.5 py-0.5 rounded text-[11px]">728x90</span>
          </div>
          <div className="text-[10.5px] text-neutral-400 mt-1">রেসপন্সিভ মোবাইল ও ডেস্কটপ</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-neutral-200/90 shadow-2xs">
          <span className="text-xs font-semibold text-neutral-500">স্ক্রিপ্ট সেফটি ইঞ্জিন</span>
          <div className="text-xs font-bold text-amber-700 mt-2 flex items-center gap-1">
            <Sparkles size={14} className="text-amber-500" />
            <span>Isolated Sandbox Iframe</span>
          </div>
          <div className="text-[10.5px] text-neutral-400 mt-1">নো কনফ্লিক্ট ও ক্লিন আনমাউন্ট</div>
        </div>
      </div>

      {/* Ads List Table */}
      <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-neutral-100 bg-neutral-50/50 flex items-center justify-between">
          <h3 className="text-xs font-bold text-neutral-900">
            Adsterra বিজ্ঞাপন তালিকা (Configured Units)
          </h3>
          <span className="text-[11px] text-neutral-500">
            Active বন্ধ থাকলে ওয়েবসাইটে কোনো অ্যাড দেখাবে না
          </span>
        </div>

        {ads.length === 0 ? (
          <div className="text-center py-12 px-4 space-y-2">
            <Tv size={32} className="mx-auto text-neutral-300 mb-1" />
            <p className="text-xs font-semibold text-neutral-600">কোনো Adsterra বিজ্ঞাপন পাওয়া যায়নি।</p>
            <p className="text-[11px] text-neutral-400">
              "নতুন বিজ্ঞাপন যোগ করুন" বাটনে ক্লিক করে Adsterra স্ক্রিপ্ট পেস্ট করুন।
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {ads.map((ad) => (
              <div
                key={ad.id}
                className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-neutral-50/70 transition-colors"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-neutral-900">{ad.title}</span>
                    <span className="text-[10.5px] font-mono font-bold px-2 py-0.5 bg-neutral-100 text-neutral-700 rounded-md">
                      {ad.size}
                    </span>
                    <span className="text-[10.5px] font-medium px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200/60 rounded-md">
                      {ad.format}
                    </span>
                    {ad.active ? (
                      <span className="text-[10.5px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md flex items-center gap-1">
                        <CheckCircle2 size={11} /> Active (লাইভ)
                      </span>
                    ) : (
                      <span className="text-[10.5px] font-bold px-2 py-0.5 bg-neutral-100 text-neutral-500 rounded-md flex items-center gap-1">
                        <XCircle size={11} /> Inactive (বন্ধ)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-neutral-500 flex-wrap">
                    <div className="flex items-center gap-1 text-neutral-700 font-medium">
                      <Layers size={13} className="text-amber-600" />
                      <span>{PLACEMENT_LABELS[ad.placement] || ad.placement}</span>
                    </div>
                    <span>•</span>
                    <div className="flex items-center gap-1 text-neutral-600">
                      {ad.deviceTarget === 'mobile_only' ? (
                        <span className="flex items-center gap-1 text-amber-700 font-medium">
                          <Smartphone size={13} /> শুধু মোবাইল
                        </span>
                      ) : ad.deviceTarget === 'desktop_only' ? (
                        <span className="flex items-center gap-1 text-blue-700 font-medium">
                          <Monitor size={13} /> শুধু কম্পিউটার/ডেস্কটপ
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-neutral-600">
                          <Globe size={13} /> সকল ডিভাইসে
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-[10.5px] font-mono text-neutral-400 truncate max-w-lg">
                    {ad.adCode ? ad.adCode.substring(0, 100).replace(/\n/g, ' ') + '...' : 'No script'}
                  </div>
                </div>

                {/* Right Side Actions */}
                <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
                  <button
                    type="button"
                    onClick={() => setPreviewAd(ad)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Eye size={13} />
                    <span>লাইভ প্রিভিউ</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleActive(ad.id, ad.active)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      ad.active
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    {ad.active ? 'সক্রিয় (ON)' : 'নিষ্ক্রিয় (OFF)'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEdit(ad)}
                    className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
                    title="সম্পাদনা করুন"
                  >
                    <Edit2 size={15} />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(ad.id)}
                    className="p-2 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                    title="মুছে ফেলুন"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ad Form Modal */}
      <AdFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingAd(null);
        }}
        adToEdit={editingAd}
      />

      {/* Live Preview Modal */}
      {previewAd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 border border-neutral-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <Eye size={18} className="text-amber-600" />
                <h3 className="text-sm font-bold text-neutral-900">
                  Adsterra Live Preview ({previewAd.size})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewAd(null)}
                className="p-1 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100"
              >
                <XCircle size={18} />
              </button>
            </div>

            <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 flex flex-col items-center justify-center min-h-[120px]">
              <AdDisplaySlot ad={previewAd} />
            </div>

            <div className="text-[11px] text-neutral-500 bg-amber-50/60 p-3 rounded-xl border border-amber-200/50">
              <strong>টিপস:</strong> Adsterra এর লাইভ বিজ্ঞাপন লোড হতে ইন্টারনেট স্পিড ও স্ক্রিপ্ট রেসপন্সের উপর ভিত্তি করে কয়েক সেকেন্ড সময় নিতে পারে।
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewAd(null)}
                className="px-4 py-2 text-xs font-bold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
